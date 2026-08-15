from __future__ import annotations

import argparse

from .compile_book import compile_book
from .server import DEFAULT_HOST, DEFAULT_PORT, serve


def main() -> None:
    parser = argparse.ArgumentParser(prog="yugioh-agentic")
    sub = parser.add_subparsers(dest="cmd", required=True)
    serve_p = sub.add_parser("serve", help="HTTP teach server")
    serve_p.add_argument("--host", default=DEFAULT_HOST)
    serve_p.add_argument("--port", type=int, default=DEFAULT_PORT)
    sub.add_parser("compile-book", help="book.json → agents/toon-2026/resources/book.md")
    args = parser.parse_args()
    if args.cmd == "serve":
        serve(args.host, args.port)
        return
    if args.cmd == "compile-book":
        print(compile_book())


if __name__ == "__main__":
    main()
