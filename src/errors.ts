// Manually “tree shaken” from:
// <https://github.com/nodejs/node/blob/89f592c/lib/internal/errors.js>
import assert from 'assert'
// Needed for types.
// eslint-disable-next-line no-unused-vars
import {format, inspect} from 'util'

const isWindows = process.platform === 'win32'

const own = {}.hasOwnProperty

export const codes:any = {}

export type MessageFunction = (...args: any[]) => string
/**
 * @typedef {(...args: unknown[]) => string} MessageFunction
 */

/** @type {Map<string, MessageFunction|string>} */
const messages = new Map()
const nodeInternalPrefix = '__node_internal_'
/** @type {number} */
let userStackTraceLimit:any

codes.ERR_INVALID_MODULE_SPECIFIER = createError(
  'ERR_INVALID_MODULE_SPECIFIER',
  /**
   * @param {string} request
   * @param {string} reason
   * @param {string} [base]
   */
  (request:string, reason:string, base:string|undefined = undefined) => {
    return `Invalid module "${request}" ${reason}${
      base ? ` imported from ${base}` : ''
    }`
  },
  TypeError
)

codes.ERR_INVALID_PACKAGE_CONFIG = createError(
  'ERR_INVALID_PACKAGE_CONFIG',
  /**
   * @param {string} path
   * @param {string} [base]
   * @param {string} [message]
   */
  (path:string, base:string, message:string) => {
    return `Invalid package config ${path}${
      base ? ` while importing ${base}` : ''
    }${message ? `. ${message}` : ''}`
  },
  Error
)

codes.ERR_INVALID_PACKAGE_TARGET = createError(
  'ERR_INVALID_PACKAGE_TARGET',
  /**
   * @param {string} pkgPath
   * @param {string} key
   * @param {unknown} target
   * @param {boolean} [isImport=false]
   * @param {string} [base]
   */
  (pkgPath:string, key:string, target:unknown, isImport = false, base:string|undefined = undefined) => {
    const relError =
      typeof target === 'string' &&
      !isImport &&
      target.length > 0 &&
      !target.startsWith('./')
    if (key === '.') {
      assert(isImport === false)
      return (
        `Invalid "exports" main target ${JSON.stringify(target)} defined ` +
        `in the package config ${pkgPath}package.json${
          base ? ` imported from ${base}` : ''
        }${relError ? '; targets must start with "./"' : ''}`
      )
    }

    return `Invalid "${
      isImport ? 'imports' : 'exports'
    }" target ${JSON.stringify(
      target
    )} defined for '${key}' in the package config ${pkgPath}package.json${
      base ? ` imported from ${base}` : ''
    }${relError ? '; targets must start with "./"' : ''}`
  },
  Error
)

codes.ERR_MODULE_NOT_FOUND = createError(
  'ERR_MODULE_NOT_FOUND',
  /**
   * @param {string} path
   * @param {string} base
   * @param {string} [type]
   */
  (path:string, base:string, type = 'package') => {
    return `Cannot find ${type} '${path}' imported from ${base}`
  },
  Error
)

codes.ERR_PACKAGE_IMPORT_NOT_DEFINED = createError(
  'ERR_PACKAGE_IMPORT_NOT_DEFINED',
  /**
   * @param {string} specifier
   * @param {string} packagePath
   * @param {string} base
   */
  (specifier:string, packagePath:string, base:string) => {
    return `Package import specifier "${specifier}" is not defined${
      packagePath ? ` in package ${packagePath}package.json` : ''
    } imported from ${base}`
  },
  TypeError
)

codes.ERR_PACKAGE_PATH_NOT_EXPORTED = createError(
  'ERR_PACKAGE_PATH_NOT_EXPORTED',
  /**
   * @param {string} pkgPath
   * @param {string} subpath
   * @param {string} [base]
   */
  (pkgPath:string, subpath:string, base = undefined) => {
    if (subpath === '.')
      return `No "exports" main defined in ${pkgPath}package.json${
        base ? ` imported from ${base}` : ''
      }`
    return `Package subpath '${subpath}' is not defined by "exports" in ${pkgPath}package.json${
      base ? ` imported from ${base}` : ''
    }`
  },
  Error
)

codes.ERR_UNSUPPORTED_DIR_IMPORT = createError(
  'ERR_UNSUPPORTED_DIR_IMPORT',
  "Directory import '%s' is not supported " +
    'resolving ES modules imported from %s',
  Error
)

codes.ERR_UNKNOWN_FILE_EXTENSION = createError(
  'ERR_UNKNOWN_FILE_EXTENSION',
  'Unknown file extension "%s" for %s',
  TypeError
)

codes.ERR_INVALID_ARG_VALUE = createError(
  'ERR_INVALID_ARG_VALUE',
  /**
   * @param {string} name
   * @param {unknown} value
   * @param {string} [reason='is invalid']
   */
  (name:string, value:unknown, reason = 'is invalid') => {
    let inspected = inspect(value)

    if (inspected.length > 128) {
      inspected = `${inspected.slice(0, 128)}...`
    }

    const type = name.includes('.') ? 'property' : 'argument'

    return `The ${type} '${name}' ${reason}. Received ${inspected}`
  },
  TypeError
  // Note: extra classes have been shaken out.
  // , RangeError
)

codes.ERR_UNSUPPORTED_ESM_URL_SCHEME = createError(
  'ERR_UNSUPPORTED_ESM_URL_SCHEME',
  /**
   * @param {URL} url
   */
  (url:URL) => {
    let message =
      'Only file and data URLs are supported by the default ESM loader'

    if (isWindows && url.protocol.length === 2) {
      message += '. On Windows, absolute paths must be valid file:// URLs'
    }

    message += `. Received protocol '${url.protocol}'`
    return message
  },
  Error
)

/**
 * Utility function for registering the error codes. Only used here. Exported
 * *only* to allow for testing.
 * @param {string} sym
 * @param {MessageFunction|string} value
 * @param {ErrorConstructor} def
 * @returns {new (...args: unknown[]) => Error}
 */
function createError(sym:string, value:MessageFunction|string, def:ErrorConstructor) {
  // Special case for SystemError that formats the error message differently
  // The SystemErrors only have SystemError as their base classes.
  messages.set(sym, value)

  return makeNodeErrorWithCode(def, sym)
}

/**
 * @param {ErrorConstructor} Base
 * @param {string} key
 * @returns {ErrorConstructor}
 */
function makeNodeErrorWithCode(Base:any, key:string) {
  return NodeError
  /**
   * @param {unknown[]} args
   */
  function NodeError(...args:any[]) {
    const limit = Error.stackTraceLimit
    if (isErrorStackTraceLimitWritable()) Error.stackTraceLimit = 0
    const error = new Base()
    // Reset the limit and setting the name property.
    if (isErrorStackTraceLimitWritable()) Error.stackTraceLimit = limit
    const message = getMessage(key, args, error)
    Object.defineProperty(error, 'message', {
      value: message,
      enumerable: false,
      writable: true,
      configurable: true
    })
    Object.defineProperty(error, 'toString', {
      /** @this {Error} */
      value() {
        return `${this.name} [${key}]: ${this.message}`
      },
      enumerable: false,
      writable: true,
      configurable: true
    })
    addCodeToName(error, Base.name, key)
    error.code = key
    return error
  }
}

const addCodeToName = hideStackFrames(
  /**
   * @param {Error} error
   * @param {string} name
   * @param {string} code
   * @returns {void}
   */
  function (error:Error, name:string, code:string):void {
    // Set the stack
    error = captureLargerStackTrace(error)
    // Add the error code to the name to include it in the stack trace.
    error.name = `${name} [${code}]`
    // Access the stack to generate the error message including the error code
    // from the name.
    error.stack // eslint-disable-line no-unused-expressions
    // Reset the name to the actual name.
    if (name === 'SystemError') {
      Object.defineProperty(error, 'name', {
        value: name,
        enumerable: false,
        writable: true,
        configurable: true
      })
    } else {
      error.name = ''
    }
  }
)

/**
 * @returns {boolean}
 */
function isErrorStackTraceLimitWritable() {
  const desc = Object.getOwnPropertyDescriptor(Error, 'stackTraceLimit')
  if (desc === undefined) {
    return Object.isExtensible(Error)
  }

  return own.call(desc, 'writable') ? desc.writable : desc.set !== undefined
}

/**
 * This function removes unnecessary frames from Node.js core errors.
 * @template {(...args: unknown[]) => unknown} T
 * @type {(fn: T) => T}
 */
function hideStackFrames(fn:(...args: any[]) => any) {
  // We rename the functions that will be hidden to cut off the stacktrace
  // at the outermost one
  const hidden = nodeInternalPrefix + fn.name
  Object.defineProperty(fn, 'name', {value: hidden})
  return fn
}

const captureLargerStackTrace:(err:Error)=>Error = hideStackFrames(
  /**
   * @param {Error} error
   * @returns {Error}
   */
  function (error:Error):Error {
    const stackTraceLimitIsWritable = isErrorStackTraceLimitWritable()
    if (stackTraceLimitIsWritable) {
      userStackTraceLimit = Error.stackTraceLimit
      Error.stackTraceLimit = Number.POSITIVE_INFINITY
    }

    Error.captureStackTrace(error)

    // Reset the limit
    if (stackTraceLimitIsWritable) Error.stackTraceLimit = userStackTraceLimit

    return error
  }
)

/**
 * @param {string} key
 * @param {unknown[]} args
 * @param {Error} self
 * @returns {string}
 */
function getMessage(key:string, args:unknown[], self:Error):string {
  const message = messages.get(key)

  if (typeof message === 'function') {
    assert(
      message.length <= args.length, // Default options do not count.
      `Code: ${key}; The provided arguments length (${args.length}) does not ` +
        `match the required ones (${message.length}).`
    )
    return Reflect.apply(message, self, args)
  }

  const expectedLength = (message.match(/%[dfijoOs]/g) || []).length
  assert(
    expectedLength === args.length,
    `Code: ${key}; The provided arguments length (${args.length}) does not ` +
      `match the required ones (${expectedLength}).`
  )
  if (args.length === 0) return message

  args.unshift(message)
  return Reflect.apply(format, null, args)
}
