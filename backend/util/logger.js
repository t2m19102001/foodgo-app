const write = (level, consoleFn, args) => {
  consoleFn(`${new Date().toISOString()} [${level}]`, ...args);
};

export const logger = {
  info: (...args) => write("INFO", console.log, args),
  warn: (...args) => write("WARN", console.warn, args),
  error: (...args) => write("ERROR", console.error, args),
};

export default logger;
