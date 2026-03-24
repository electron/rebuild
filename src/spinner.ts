import { styleText } from 'node:util';

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  text: string;
  private i = 0;
  private timer: NodeJS.Timeout | undefined;
  private readonly tty = process.stderr.isTTY;

  constructor(text: string) {
    this.text = text;
  }

  start(): this {
    if (this.tty) {
      this.timer = setInterval(() => {
        process.stderr.write(`\r${styleText('cyan', frames[this.i++ % frames.length])} ${this.text}\x1b[K`);
      }, 80);
    }
    return this;
  }

  private stop(symbol: string): void {
    if (this.timer) clearInterval(this.timer);
    const out = `${symbol} ${this.text}\n`;
    process.stderr.write(this.tty ? `\r${out}\x1b[K` : out);
  }

  succeed(): void {
    this.stop(styleText('green', '✔'));
  }

  fail(): void {
    this.stop(styleText('red', '✖'));
  }
}
