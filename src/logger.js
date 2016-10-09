import colors from 'colors/safe';

var colorList = ['blue', 'yellow', 'magenta', 'cyan'];

var enabled = !!process.env.DEBUG;

export default function logger (command, ...messages) {
  if (enabled) {
    var color = colorList[command.length % colorList.length];
    console.log.apply(console, [colors[color](command)].concat(messages));
  }
}

logger.print = function print (...data) {
  if (enabled) {
    console.log.apply(console, data);
  }
};

logger.enable = function () {
  enabled = true;
};

logger.disable = function () {
  enabled = false;
};
