import colors from 'colors/safe';

const colorList = ['blue', 'magenta', 'cyan'];
let enabled = false;

export default function logger (command, ...messages) {
  if (enabled) {
    if (messages.length == 0) {
      console.log(command);
    } else {
      var color = colorList[command.length % colorList.length];
      console.log.apply(console, [colors[color](command)].concat(messages));
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
