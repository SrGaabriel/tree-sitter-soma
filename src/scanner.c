#include "tree_sitter/parser.h"
#include <wctype.h>
#include <string.h>
#include <stdio.h>

enum TokenType {
    NEWLINE,
    INDENT,
    DEDENT,
    ERROR_SENTINEL,
};

typedef struct {
    uint16_t *indents;
    uint16_t size;
    uint16_t capacity;
} IndentStack;

static IndentStack *indent_stack_create() {
    IndentStack *stack = malloc(sizeof(IndentStack));
    stack->capacity = 16;
    stack->size = 0;
    stack->indents = malloc(stack->capacity * sizeof(uint16_t));
    stack->indents[0] = 0;
    stack->size = 1;
    return stack;
}

static void indent_stack_destroy(IndentStack *stack) {
    free(stack->indents);
    free(stack);
}

static void indent_stack_push(IndentStack *stack, uint16_t indent) {
    if (stack->size == stack->capacity) {
        stack->capacity *= 2;
        stack->indents = realloc(stack->indents, stack->capacity * sizeof(uint16_t));
    }
    stack->indents[stack->size++] = indent;
}

static void indent_stack_pop(IndentStack *stack) {
    if (stack->size > 1) {
        stack->size--;
    }
}

static uint16_t indent_stack_peek(const IndentStack *stack) {
    if (stack->size == 0) return 0;
    return stack->indents[stack->size - 1];
}

static void indent_stack_reset(IndentStack *stack) {
    stack->size = 1;
    stack->indents[0] = 0;
}

static unsigned indent_stack_serialize(const IndentStack *stack, char *buffer) {
    unsigned size = stack->size * sizeof(uint16_t);
    if (size > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) {
        size = TREE_SITTER_SERIALIZATION_BUFFER_SIZE;
    }
    memcpy(buffer, stack->indents, size);
    return size;
}

static void indent_stack_deserialize(IndentStack *stack, const char *buffer, unsigned length) {
    stack->size = 0;
    if (length > 0) {
        unsigned new_size = length / sizeof(uint16_t);
        if (new_size > stack->capacity) {
            stack->capacity = new_size;
            stack->indents = realloc(stack->indents, stack->capacity * sizeof(uint16_t));
        }
        memcpy(stack->indents, buffer, length);
        stack->size = new_size;
    }
    if (stack->size == 0) {
        stack->indents[0] = 0;
        stack->size = 1;
    }
}

void *tree_sitter_soma_external_scanner_create() {
    return indent_stack_create();
}

void tree_sitter_soma_external_scanner_destroy(void *payload) {
    IndentStack *stack = (IndentStack *)payload;
    indent_stack_destroy(stack);
}

void tree_sitter_soma_external_scanner_reset(void *payload) {
    IndentStack *stack = (IndentStack *)payload;
    indent_stack_reset(stack);
}

unsigned tree_sitter_soma_external_scanner_serialize(void *payload, char *buffer) {
    IndentStack *stack = (IndentStack *)payload;
    return indent_stack_serialize(stack, buffer);
}

void tree_sitter_soma_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    IndentStack *stack = (IndentStack *)payload;
    indent_stack_deserialize(stack, buffer, length);
}

bool tree_sitter_soma_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    IndentStack *stack = (IndentStack *)payload;

    // Don't scan if we're in error recovery mode
    if (valid_symbols[ERROR_SENTINEL]) {
        return false;
    }

    // Skip comments first (they're handled by the main parser)
    bool has_content = false;
    
    // Check if any of our tokens are valid
    if (!valid_symbols[NEWLINE] && !valid_symbols[INDENT] && !valid_symbols[DEDENT]) {
        return false;
    }

    lexer->mark_end(lexer);

    bool found_end_of_line = false;
    uint32_t indent_length = 0;
    
    // Skip whitespace and track newlines
    for (;;) {
        if (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
            indent_length++;
            lexer->advance(lexer, true);
        } else if (lexer->lookahead == '\n') {
            found_end_of_line = true;
            indent_length = 0;
            lexer->advance(lexer, true);
        } else if (lexer->lookahead == '\r') {
            found_end_of_line = true;
            indent_length = 0;
            lexer->advance(lexer, true);
            if (lexer->lookahead == '\n') {
                lexer->advance(lexer, true);
            }
        } else {
            break;
        }
    }

    // Handle end of file
    if (lexer->eof(lexer)) {
        if (valid_symbols[DEDENT] && indent_stack_peek(stack) > 0) {
            indent_stack_pop(stack);
            lexer->result_symbol = DEDENT;
            return true;
        }
        return false;
    }

    // Skip comment lines when checking indentation
    if (lexer->lookahead == '/' && found_end_of_line) {
        lexer->mark_end(lexer);
        lexer->advance(lexer, false);
        if (lexer->lookahead == '/') {
            // It's a comment, skip to end of line
            while (lexer->lookahead != '\n' && lexer->lookahead != '\r' && !lexer->eof(lexer)) {
                lexer->advance(lexer, false);
            }
            return false; // Let parser handle the comment
        }
    }

    // ... inside tree_sitter_soma_external_scanner_scan, replacing the old logic ...

    // If we found a newline, handle indentation
    if (found_end_of_line) {
        lexer->mark_end(lexer);
        
        uint16_t current_indent = lexer->get_column(lexer);
        uint16_t last_indent = indent_stack_peek(stack);

        if (valid_symbols[INDENT] && current_indent > last_indent) {
            // 1. INDENT case
            indent_stack_push(stack, current_indent);
            lexer->result_symbol = INDENT;
            return true;
        }

        // 2. DEDENT case (CRITICAL FIX: Use a while loop for multiple DEDENTS)
        while (valid_symbols[DEDENT] && current_indent < last_indent) {
            indent_stack_pop(stack);
            last_indent = indent_stack_peek(stack); // Update last_indent after pop
            
            // If the indentation matches an expected level, we've found the correct stop
            if (current_indent == last_indent) {
                lexer->result_symbol = DEDENT;
                return true;
            }
            
            // Continue to pop and emit DEDENTs until we match or undershoot
        }

        // If current_indent is less than *any* previous indent level
        // and we didn't match the new expected level, that's an IndentationError.
        // The default Tree-sitter error recovery might handle this, 
        // but you might want to emit ERROR_SENTINEL here.
        if (current_indent < last_indent) {
            // Indentation error (e.g., indent is 3 when it should be 4 or 0)
            // If you don't handle this, the parser will likely fail anyway.
            // For simplicity in a basic scanner, we often rely on the parser to error.
        }

        // 3. NEWLINE case
        if (valid_symbols[NEWLINE] && current_indent == last_indent) {
            lexer->result_symbol = NEWLINE;
            return true;
        }
    }

    return false;
}