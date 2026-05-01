const noop = () => {};
const isDev = import.meta.env.DEV;

export const log = isDev ? console.log.bind(console) : noop;
export const warn = isDev ? console.warn.bind(console) : noop;
