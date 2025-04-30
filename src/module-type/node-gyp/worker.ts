import NodeGypRunner from 'node-gyp';

process.on('message', async ({
  nodeGypArgs,
  devDir,
  extraNodeGypArgs,
}) => {
  const nodeGyp = NodeGypRunner();
  nodeGyp.parseArgv(nodeGypArgs);
  nodeGyp.devDir = devDir;
  let command = nodeGyp.todo.shift();
  try {
    while (command) {
      if (command.name === 'configure') {
        command.args = command.args.filter((arg: string) => !extraNodeGypArgs.includes(arg));
      } else if (command.name === 'build' && process.platform === 'win32') {
        // This is disgusting but it prevents node-gyp from destroying our MSBuild arguments
        command.args.map = (fn: (arg: string) => string) => {
          return Array.prototype.map.call(command.args, (arg: string) => {
            if (arg.startsWith('/p:')) return arg;
            return fn(arg);
          });
        };
      }
      await nodeGyp.commands[command.name](command.args);
      command = nodeGyp.todo.shift();
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});
