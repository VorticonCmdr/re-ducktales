"""One owned native experiment,using a portable primary config and unchanged HOME.
Only the human-configured emulator is copied;no shared bridge/session is used.
"""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import time


class PortableSession:
    def __init__(self, config, attach, output, mount_root, *, machine='svga_s3'):
        assert machine in ['svga_s3', 'ega']
        self.config = config
        self.attach = attach
        self.output = Path(output)
        self.directory = self.output / 'portable'
        self.directory.mkdir()
        self.binary = self.directory / 'dosbox_with_debugger'
        assert config.binary and config.binary.is_file()
        shutil.copy2(config.binary, self.binary)
        mount_root = str(Path(mount_root).resolve())
        assert not any(ch in mount_root for ch in ['"', '\n', '\r', ';'])
        text = ('[webserver]\nwebserver_enabled = true\n'
                'webserver_bind_address = 127.0.0.1\nwebserver_allow_remote = false\n'
                'webserver_require_auth = true\nwebserver_token_file = false\n'
                'webserver_osd = false\nwebserver_port = ' + str(config.port) + '\n'
                'mount_allowed_bases = ' + mount_root + '\n'
                '[debug]\ndebugger_window = false\n'
                '[dosbox]\nmachine = ' + machine + '\nmemsize = 16\nvmem_delay = off\n'
                '[cpu]\ncore = normal\ncpu_cycles = 3000\n')
        (self.directory / 'dosbox-automation.conf').write_text(text)
        self.process = None
        self.log = None

    @property
    def pid(self):
        return self.process.pid if self.process else None

    @property
    def running(self):
        return self.process is not None and self.process.poll() is None

    def build_argv(self):
        return [str(self.binary.resolve()), '--nolocalconf']

    def start(self):
        assert not self.process
        token = secrets.token_hex(32)
        env = dict(os.environ)
        env.update(SDL_VIDEODRIVER='dummy', SDL_AUDIODRIVER='dummy', DOSBOX_API_TOKEN=token)
        self.log = (self.output / 'emulator.log').open('wb')
        self.process = subprocess.Popen(self.build_argv(), cwd=self.directory,
                                        env=env, stdout=self.log, stderr=subprocess.STDOUT)
        deadline = time.monotonic() + 20
        last_error = None
        while time.monotonic() < deadline:
            assert self.running, 'Owned emulator exited during startup'
            try:
                return self.attach(self.config.base_url, token)
            except Exception as error:
                last_error = error
                time.sleep(.1)
        raise AssertionError('Owned emulator did not become ready') from last_error

    def stop(self):
        if self.running:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        if self.log:
            self.log.close()
        receipt = {'ownedPID': self.pid, 'terminal': not self.running,
                   'returnCode': self.process.returncode if self.process else None,
                   'sharedSessionChanged': False, 'homeOverridden': False}
        (self.output / 'lifecycle.json').write_text(json.dumps(receipt, indent=2)+'\n')
