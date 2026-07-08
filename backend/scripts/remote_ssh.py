"""临时 SSH 助手：用密码方式连接服务器并执行命令。
仅用于一次性部署，部署后建议改为 key 认证。
"""

from __future__ import annotations

import argparse
import os
import sys

import paramiko

HOST = "132.232.137.45"
USER = "root"
PASSWORD = "Admin@321"


def run(cmd: str, timeout: int = 120, get_pty: bool = False) -> tuple[int, str, str]:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    try:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=get_pty)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        rc = stdout.channel.recv_exit_status()
        return rc, out, err
    finally:
        client.close()


def upload(local: str, remote: str) -> None:
    transport = paramiko.Transport((HOST, 22))
    transport.connect(username=USER, password=PASSWORD)
    sftp = paramiko.SFTPClient.from_transport(transport)
    try:
        sftp.put(local, remote)
    finally:
        sftp.close()
        transport.close()


def upload_dir(local_dir: str, remote_dir: str, ignore: list[str] | None = None) -> int:
    """递归上传目录。返回上传的文件数。"""
    ignore = ignore or []

    transport = paramiko.Transport((HOST, 22))
    transport.connect(username=USER, password=PASSWORD)
    sftp = paramiko.SFTPClient.from_transport(transport)
    count = 0

    def _mkdir_p(path: str) -> None:
        parts = path.strip("/").split("/")
        cur = ""
        for part in parts:
            cur = cur + "/" + part
            try:
                sftp.stat(cur)
            except FileNotFoundError:
                sftp.mkdir(cur)

    def _should_skip(path: str) -> bool:
        for pat in ignore:
            if pat in path:
                return True
        return False

    try:
        _mkdir_p(remote_dir)
        for root, dirs, files in os.walk(local_dir):
            dirs[:] = [d for d in dirs if not _should_skip(d)]
            rel = os.path.relpath(root, local_dir).replace("\\", "/")
            target = remote_dir if rel == "." else f"{remote_dir}/{rel}"
            _mkdir_p(target)
            for f in files:
                if _should_skip(f):
                    continue
                local_path = os.path.join(root, f)
                remote_path = f"{target}/{f}"
                try:
                    sftp.put(local_path, remote_path)
                    count += 1
                except Exception as e:
                    print(f"!! upload fail {local_path}: {e}", file=sys.stderr)
    finally:
        sftp.close()
        transport.close()
    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cmd", help="execute remote command")
    parser.add_argument("--upload", nargs=2, metavar=("LOCAL", "REMOTE"))
    parser.add_argument("--upload-dir", nargs=2, metavar=("LOCAL_DIR", "REMOTE_DIR"))
    parser.add_argument("--ignore", nargs="*", default=[])
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--pty", action="store_true")
    args = parser.parse_args()

    if args.cmd:
        rc, out, err = run(args.cmd, timeout=args.timeout, get_pty=args.pty)
        # Force UTF-8 to stdout so emoji/CJK don't blow up under cp936
        if out:
            sys.stdout.buffer.write(out.encode("utf-8", "replace"))
        if err:
            sys.stderr.buffer.write(err.encode("utf-8", "replace"))
        sys.exit(rc)
    elif args.upload:
        upload(args.upload[0], args.upload[1])
        print(f"uploaded {args.upload[0]} -> {args.upload[1]}")
    elif args.upload_dir:
        n = upload_dir(args.upload_dir[0], args.upload_dir[1], ignore=args.ignore)
        print(f"uploaded {n} files")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
