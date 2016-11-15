const ansiCyan = '\u001b[36m';
const ansiReset = '\u001b[39m';
let enabled = false;

export default function logger (command, ...messages) {
  if (enabled) {
    if (messages.length == 0) {
      console.log(command);
    } else {
      command = `${ansiCyan}${command}${ansiReset}`;
      console.log(command, ...messages);
    }
  }
}

Object.defineProperty(logger, 'enabled', {
  get: () => {
    return enabled;
  },
  set: (value) => {
    return enabled = !!value;
  }
});
