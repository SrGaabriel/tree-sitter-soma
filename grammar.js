/**
 * @file Soma grammar for tree-sitter
 * @author Gabriel Minatel <gabriel@minatel.dev>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "soma",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});
