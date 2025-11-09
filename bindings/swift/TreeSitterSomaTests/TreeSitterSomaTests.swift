import XCTest
import SwiftTreeSitter
import TreeSitterSoma

final class TreeSitterSomaTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_soma())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Soma grammar")
    }
}
