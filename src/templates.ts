import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import { UnityEditor } from '@rage-against-the-pixel/unity-cli';

/**
 * Get a list of the project templates bundled with a Unity Editor.
 * @param unityEditor The Unity Editor to look in.
 * @returns The full paths of the available template packages.
 */
export function GetAvailableTemplates(unityEditor: UnityEditor): string[] {
    if (unityEditor.version.isLessThan('2019.0.0')) {
        core.warning(`Unity version ${unityEditor.version.toString()} does not support project templates.`);
        return [];
    }

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
 * Get the full path to a Unity project template based on the provided template name or regex pattern.
 * @param templates The available template paths.
 * @param template The name or regex pattern of the template to find.
 * @returns The full path to the matching template file, or undefined when none matches.
 * @throws If the template is not a valid regex.
 */
export function GetTemplatePath(templates: string[], template: string): string | undefined {
    if (templates.length === 0) {
        core.warning('No Unity templates found');
        return undefined;
    }

    // Match the template name, an optional numeric version suffix, and a required file extension
    // Example input: com.unity.template.3d(-cross-platform)?
    // Example match: com.unity.template.3d-cross-platform-1.2.3.tar.gz or com.unity.template.3d-1.2.3.tgz
    // the pattern is grouped so the anchors and suffix apply to every alternative, such as `a|b`
    let regex: RegExp;

    try {
        regex = new RegExp(`^(?:${template})(?:-\\d+\\.\\d+\\.\\d+)?(?:\\.tgz|\\.tar\\.gz)$`);
    } catch {
        throw new Error(`Invalid template regex: ${template}`);
    }

    // prefer the longest match, such as the cross-platform variant over the plain one
    const matches = templates
        .filter(t => regex.test(path.basename(t)))
        .sort((a, b) => b.length - a.length);

    if (matches.length === 0) {
        core.warning(`No matching template path found for ${template}`);
        return undefined;
    }

    return path.normalize(matches[0]!);
}
