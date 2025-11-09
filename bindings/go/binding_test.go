package tree_sitter_soma_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_soma "github.com/srgaabriel/tree-sitter-soma/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_soma.Language())
	if language == nil {
		t.Errorf("Error loading Soma grammar")
	}
}
