// "Was this module run directly, or imported?"
//
// The obvious form — `import.meta.url === \`file://${process.argv[1]}\`` — is
// wrong, and wrong in a way that produces silence rather than an error: argv[1]
// is a raw filesystem path while import.meta.url is a percent-encoded URL, so the
// comparison fails for any path containing a space, a `#`, or non-ASCII. This
// repo lives in a directory called "outredge website". Every check script ran,
// found nothing to complain about, printed nothing, and exited 0.
//
// A check that exits 0 without running is the exact failure ARCHITECTURE §9's
// counting rule exists to prevent, arriving through the door rather than the
// window: the harness was not reporting zero checks, it was not reporting at all.
//
// `pathToFileURL` does the encoding the comparison needs.
import { pathToFileURL } from 'node:url';

export const isMain = (moduleUrl) =>
  Boolean(process.argv[1]) && moduleUrl === pathToFileURL(process.argv[1]).href;
