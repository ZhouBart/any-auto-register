"""启动本地 Turnstile Solver 服务"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from api_solver import create_app, parse_args
import asyncio

if __name__ == "__main__":
    args = parse_args()
    app = create_app(
        headless=not args.no_headless,
        useragent=args.useragent,
        debug=args.debug,
        browser_type=args.browser_type,
        thread=args.thread,
        proxy_support=args.proxy,
        use_random_config=args.random,
        browser_name=args.browser,
        browser_version=args.version,
    )
    app.run(host=args.host, port=int(os.environ.get('SOLVER_PORT', '8889')))
