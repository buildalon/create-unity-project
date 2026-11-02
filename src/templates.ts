import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import { UnityEditor } from '@rage-against-the-pixel/unity-cli';

/**
 * Parse the template-name input into an ordered list of template id prefixes.
 * @param input A comma, newline or `|` separated list, such as `com.unity.template.3d, com.unity.template.urp-blank`.
 * @returns The prefixes, in the order they were given.
 * @throws If an entry has no template id in it.
 */
export function ParseTemplatePrefixes(input: string): string[] {
    const prefixes: string[] = [];

    for (const entry of splitEntries(input).map(e => e.trim()).filter(e => e.length > 0)) {
        // v3 took a regex; its leading literal part, such as com.unity.template.3d, is matched as an id prefix
        const prefix = /^[\w.-]+/.exec(entry)?.[0];

        if (!prefix) {
            throw new Error(`Invalid template name: ${entry}. Use a template id such as com.unity.template.3d.`);
        }

        if (prefix !== entry) {
            core.warning(`Template patterns are no longer supported; matching templates that start with ${prefix}.`);
        }

        prefixes.push(prefix);
    }

    return prefixes;
}

/**
 * Split the template-name input on commas, newlines and `|`, outside of brackets, so a v3 alternation such as
 * `com.unity.template.3d|com.unity.template.urp-blank` keeps its fallbacks and `x{1,2}` stays one entry.
 * @param input The template-name input.
 * @returns The entries, untrimmed.
 */
function splitEntries(input: string): string[] {
    const entries: string[] = [];
    let depth = 0;
    let current = '';

    for (const char of input) {
        if ('([{'.includes(char)) {
            depth++;
        } else if (')]}'.includes(char)) {
            depth = Math.max(0, depth - 1);
        } else if (depth === 0 && ',\n|'.includes(char)) {
            entries.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    entries.push(current);
    return entries;
}

/**
 * Pick the template for the first prefix that matches: an exact id first, then the first id that starts with it.
 * @param ids The available template ids, in the order they were listed.
 * @param prefixes The template id prefixes, in order of preference.
 * @returns The matching template id, or undefined when no prefix matches.
 */
export function MatchTemplate(ids: string[], prefixes: string[]): string | undefined {
    for (const prefix of prefixes) {
        const id = ids.find(i => i === prefix) ?? ids.find(i => i.startsWith(prefix));

        if (id) {
            return id;
        }
    }

    return undefined;
}

/**
 * Get a list of the project templates bundled with a Unity Editor, for editors the official Unity CLI cannot create projects with.
 * @param unityEditor The Unity Editor to look in.
 * @returns The full paths of the available template packages.
 */
export function GetBundledTemplates(unityEditor: UnityEditor): string[] {
    const editorRoot = path.dirname(unityEditor.editorPath);
    const templateDir = process.platform === 'darwin'
        ? path.join(path.dirname(editorRoot), 'Resources', 'PackageManager', 'ProjectTemplates')
        : path.join(editorRoot, 'Data', 'Resources', 'PackageManager', 'ProjectTemplates');

    core.debug(`Looking for templates in: ${templateDir}`);

    if (!fs.existsSync(templateDir) || !fs.statSync(templateDir).isDirectory()) {
        return [];
    }

    const templates: string[] = [];

    for (const entry of fs.readdirSync(templateDir, { withFileTypes: true })) {
        if (entry.isFile() && (entry.name.endsWith('.tgz') || entry.name.endsWith('.tar.gz'))) {
            templates.push(path.join(templateDir, entry.name));
        }
    }

    return templates;
}

/**
 * Get the template id of a bundled template package.
 * @param templatePath The template package path, such as `.../com.unity.template.3d-1.2.3.tgz`.
 * @returns The template id, such as `com.unity.template.3d`.
 */
export function GetBundledTemplateId(templatePath: string): string {
    return path.basename(templatePath).replace(/(?:-\d+\.\d+\.\d+[\w.-]*?)?\.(?:tgz|tar\.gz)$/, '');
}
