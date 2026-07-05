declare module 'json-bigint' {
  interface JSONBigOptions {
    storeAsString?: boolean
  }

  interface JSONBigInstance {
    parse: (text: string) => unknown
    stringify: (value: unknown) => string
  }

  function JSONBig(options?: JSONBigOptions): JSONBigInstance
  export default JSONBig
}
