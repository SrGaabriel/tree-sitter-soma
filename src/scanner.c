/**
 * Soma Language Scanner
 *
 * Handles indentation-sensitive layout and custom braced operators.
 *
 * This scanner emits:
 * - LAYOUT_START: When a block's indentation increases.
 * - LAYOUT_END: When a block's indentation decreases.
 * - LAYOUT_SEPARATOR: A "virtual semicolon" for items on new lines at the same indentation level.
 * - OPERATOR: For custom operators in braces like {+} or general operators.
 * - Reserved symbols and keywords if valid.
 */
#include "tree_sitter/parser.h"
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdbool.h>
#include <stdint.h>
// ========================================
// Symbols
// ========================================
typedef enum {
  LAYOUT_START = 0,
  LAYOUT_SEPARATOR,
  LAYOUT_END,
  OPERATOR,
  DEF,
  EQUAL,
  COLON_COLON,
  ARROW,
  BAR,
  DOUBLE_ARROW,
  COLON,
  IF,
  THEN,
  ELSE,
  LET,
  IN,
  COMPOSE,
  BIND,
  TRUE,
  FALSE,
  WHERE,
  WITH,
  INTRINSIC,
  DATA,
  TRAIT,
  INSTANCE,
  USE,
  REVERSE_ARROW,
} Symbol;
// ========================================
// Scanner State
// ========================================
#define MAX_INDENTS 64
typedef struct {
  uint32_t indents[MAX_INDENTS];
  uint32_t indent_count;
  uint32_t expected_indent;
  bool indent_computed;
} Scanner;
// ========================================
// Helper Functions
// ========================================
static void push_indent(Scanner *s, uint32_t indent) {
  if (s->indent_count < MAX_INDENTS) {
    s->indents[s->indent_count] = indent;
    s->indent_count++;
  }
}
static void pop_indent(Scanner *s) {
  if (s->indent_count > 0) {
    s->indent_count--;
  }
}
static uint32_t current_indent(Scanner *s) {
  if (s->indent_count == 0) return 0;
  return s->indents[s->indent_count - 1];
}
static bool is_operator_char(int32_t c) {
  return c == '+' || c == '-' || c == '*' ||
         c == '<' || c == '>' || c == '=' || c == '!' ||
         c == '&' || c == '|' || c == '%' || c == '^' ||
         c == '~' || c == ':' || c == '.' || c == '$' ||
         c == '?' || c == '/';
}
static bool isalnumreimpl(int c) {
  return ((c >= 'A' && c <= 'Z') ||
          (c >= 'a' && c <= 'z') ||
          (c >= '0' && c <= '9'));
}
static bool is_ident_char(int32_t c) {
  return isalnumreimpl(c) || c == '_' || c == '\'';
}
static bool scan_operator_in_braces(TSLexer *ts_lexer) {
  if (ts_lexer->lookahead != '{') return false;
  ts_lexer->advance(ts_lexer, false); // Consume '{'
  if (!is_operator_char(ts_lexer->lookahead)) return false;
  while (is_operator_char(ts_lexer->lookahead)) {
    ts_lexer->advance(ts_lexer, false);
  }
  if (ts_lexer->lookahead != '}') return false;
  ts_lexer->advance(ts_lexer, false); // Consume '}'
  ts_lexer->mark_end(ts_lexer);
  return true;
}
static bool match_keyword(TSLexer *ts_lexer, const char *str) {
  size_t len = strlen(str);
  for (size_t i = 0; i < len; i++) {
    if (ts_lexer->lookahead != str[i]) return false;
    ts_lexer->advance(ts_lexer, false);
  }
  if (is_ident_char(ts_lexer->lookahead)) return false;
  return true;
}
void *tree_sitter_soma_external_scanner_create(void) {
  Scanner *scanner = calloc(1, sizeof(Scanner));
  scanner->indent_count = 0;
  scanner->indent_computed = false;
  push_indent(scanner, 0);
  return scanner;
}
void tree_sitter_soma_external_scanner_destroy(void *payload) {
  free(payload);
}
unsigned tree_sitter_soma_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *scanner = (Scanner *)payload;
  size_t size = sizeof(Scanner);
  if (size > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) return 0;
  memcpy(buffer, scanner, size);
  return size;
}
void tree_sitter_soma_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  Scanner *scanner = (Scanner *)payload;
  if (length == 0) {
    scanner->indent_count = 0;
    scanner->indent_computed = false;
    push_indent(scanner, 0);
  } else {
    memcpy(scanner, buffer, length);
  }
}
bool tree_sitter_soma_external_scanner_scan(void *payload, TSLexer *ts_lexer, const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;
  while (true) {
    // Handle LAYOUT_END for error recovery
    if (valid_symbols[LAYOUT_END] && scanner->indent_count > 1) {
      if (scanner->indent_computed && scanner->expected_indent < current_indent(scanner)) {
        pop_indent(scanner);
        ts_lexer->result_symbol = LAYOUT_END;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
    }
    // Skip horizontal whitespace
    while (ts_lexer->lookahead == ' ' || ts_lexer->lookahead == '\t' || ts_lexer->lookahead == '\r') {
      ts_lexer->advance(ts_lexer, true);
    }
    // Handle EOF
    if (ts_lexer->lookahead == 0) {
      if (scanner->indent_count > 1 && valid_symbols[LAYOUT_END]) {
        pop_indent(scanner);
        ts_lexer->result_symbol = LAYOUT_END;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      return false;
    }
    // Handle pending layout tokens
    if (scanner->indent_computed) {
      uint32_t current = current_indent(scanner);
      if (scanner->expected_indent > current && valid_symbols[LAYOUT_START]) {
        push_indent(scanner, scanner->expected_indent);
        ts_lexer->result_symbol = LAYOUT_START;
        ts_lexer->mark_end(ts_lexer);
        scanner->indent_computed = false;
        return true;
      } else if (scanner->expected_indent < current && valid_symbols[LAYOUT_END]) {
        pop_indent(scanner);
        ts_lexer->result_symbol = LAYOUT_END;
        ts_lexer->mark_end(ts_lexer);
        if (scanner->expected_indent < current_indent(scanner)) {
          continue; // Emit more dedents if needed
        } else {
          scanner->indent_computed = false;
          return true;
        }
      } else if (scanner->expected_indent == current && valid_symbols[LAYOUT_SEPARATOR]) {
        ts_lexer->result_symbol = LAYOUT_SEPARATOR;
        ts_lexer->mark_end(ts_lexer);
        scanner->indent_computed = false;
        return true;
      }
      scanner->indent_computed = false;
    }
    // Handle newlines and compute indentation
    if (ts_lexer->lookahead == '\n') {
      ts_lexer->advance(ts_lexer, true);
      uint32_t indent = 0;
      while (true) {
        while (ts_lexer->lookahead == ' ' || ts_lexer->lookahead == '\t' || ts_lexer->lookahead == '\r') {
          ts_lexer->advance(ts_lexer, true);
        }
        if (ts_lexer->lookahead == 0) break;
        if (ts_lexer->lookahead == '\n') {
          ts_lexer->advance(ts_lexer, true);
          continue;
        } else {
          indent = ts_lexer->get_column(ts_lexer);
          break;
        }
      }
      scanner->expected_indent = indent;
      scanner->indent_computed = true;
      continue; // Loop back to handle pending layout
    }
    // Keywords
    if (islower(ts_lexer->lookahead) || ts_lexer->lookahead == '_') {
      if (valid_symbols[DEF] && match_keyword(ts_lexer, "def")) {
        ts_lexer->result_symbol = DEF;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[IF] && match_keyword(ts_lexer, "if")) {
        ts_lexer->result_symbol = IF;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[THEN] && match_keyword(ts_lexer, "then")) {
        ts_lexer->result_symbol = THEN;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[ELSE] && match_keyword(ts_lexer, "else")) {
        ts_lexer->result_symbol = ELSE;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[LET] && match_keyword(ts_lexer, "let")) {
        ts_lexer->result_symbol = LET;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[IN] && match_keyword(ts_lexer, "in")) {
        ts_lexer->result_symbol = IN;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[COMPOSE] && match_keyword(ts_lexer, "compose")) {
        ts_lexer->result_symbol = COMPOSE;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[BIND] && match_keyword(ts_lexer, "bind")) {
        ts_lexer->result_symbol = BIND;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[TRUE] && match_keyword(ts_lexer, "true")) {
        ts_lexer->result_symbol = TRUE;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[FALSE] && match_keyword(ts_lexer, "false")) {
        ts_lexer->result_symbol = FALSE;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[WHERE] && match_keyword(ts_lexer, "where")) {
        ts_lexer->result_symbol = WHERE;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[WITH] && match_keyword(ts_lexer, "with")) {
        ts_lexer->result_symbol = WITH;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[INTRINSIC] && match_keyword(ts_lexer, "intrinsic")) {
        ts_lexer->result_symbol = INTRINSIC;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[DATA] && match_keyword(ts_lexer, "data")) {
        ts_lexer->result_symbol = DATA;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[TRAIT] && match_keyword(ts_lexer, "trait")) {
        ts_lexer->result_symbol = TRAIT;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[INSTANCE] && match_keyword(ts_lexer, "instance")) {
        ts_lexer->result_symbol = INSTANCE;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      if (valid_symbols[USE] && match_keyword(ts_lexer, "use")) {
        ts_lexer->result_symbol = USE;
        ts_lexer->mark_end(ts_lexer);
        return true;
      }
      return false;
    }
    // Operators and symbols
    if (is_operator_char(ts_lexer->lookahead)) {
      int32_t op_buf[32];
      uint32_t op_len = 0;
      op_buf[op_len++] = ts_lexer->lookahead;
      ts_lexer->advance(ts_lexer, false);
      while (is_operator_char(ts_lexer->lookahead) && op_len < 31) {
        op_buf[op_len++] = ts_lexer->lookahead;
        ts_lexer->advance(ts_lexer, false);
      }
      ts_lexer->mark_end(ts_lexer);
      // Check for reserved symbols
      if (op_len == 2 && op_buf[0] == '-' && op_buf[1] == '>') {
        if (valid_symbols[ARROW]) {
          ts_lexer->result_symbol = ARROW;
          return true;
        }
      } else if (op_len == 2 && op_buf[0] == '=' && op_buf[1] == '>') {
        if (valid_symbols[DOUBLE_ARROW]) {
          ts_lexer->result_symbol = DOUBLE_ARROW;
          return true;
        }
      } else if (op_len == 2 && op_buf[0] == ':' && op_buf[1] == ':') {
        if (valid_symbols[COLON_COLON]) {
          ts_lexer->result_symbol = COLON_COLON;
          return true;
        }
      } else if (op_len == 1 && op_buf[0] == '=') {
        if (valid_symbols[EQUAL]) {
          ts_lexer->result_symbol = EQUAL;
          return true;
        }
      } else if (op_len == 1 && op_buf[0] == '|') {
        if (valid_symbols[BAR]) {
          ts_lexer->result_symbol = BAR;
          return true;
        }
      } else if (op_len == 1 && op_buf[0] == ':') {
        if (valid_symbols[COLON]) {
          ts_lexer->result_symbol = COLON;
          return true;
        }
      } else if (op_len == 2 && op_buf[0] == '<' && op_buf[1] == '-') {
        if (valid_symbols[REVERSE_ARROW]) {
          ts_lexer->result_symbol = REVERSE_ARROW;
          return true;
        }
      } else if (valid_symbols[OPERATOR]) {
        ts_lexer->result_symbol = OPERATOR;
        return true;
      }
    }
    // Braced operators
    if (valid_symbols[OPERATOR] && ts_lexer->lookahead == '{') {
      if (scan_operator_in_braces(ts_lexer)) {
        ts_lexer->result_symbol = OPERATOR;
        return true;
      }
    }
    return false;
  }
}
