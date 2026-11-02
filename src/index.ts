import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import { FindAbsolutePath, UnityCli, UnityEditor } from '@rage-against-the-pixel/unity-cli';
import { ClassifyFailure } from '@rage-against-the-pixel/unity-cli/dist/failure-markers';
import { GetBundledTemplateId, GetBundledTemplates, MatchTemplate, ParseTemplatePrefixes } from './templates';

async function main() {
    try {
        if (!process.env.UNITY_EDITOR_PATH) {
            throw new Error('UNITY_EDITOR_PATH environment variable must be set!');
        }

        const unityEditor = new UnityEditor(process.env.UNITY_EDITOR_PATH);
        core.info(`Using Unity Editor at path:\n  > ${unityEditor.editorPath}`);

        const prefixes = ParseTemplatePrefixes(core.getInput('template-name'));
        const projectNameInput = core.getInput('project-name', { required: true });
        const projectDirectoryInput = core.getInput('project-directory') || process.cwd();
        const projectPath = `${projectDirectoryInput}/${projectNameInput}`;

        // the official Unity CLI lists and creates templates for 2019.1 and newer
        if (unityEditor.version.isLessThan('2019.1.0')) {
            await createLegacyProject(unityEditor, projectPath, prefixes);
        } else {
            await createProject(unityEditor, projectDirectoryInput, projectNameInput, projectPath, prefixes);
        }

        core.setOutput('project-path', projectPath);
    } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        // a failure a rerun can clear gets a notice titled with its marker, which retry-failed-jobs looks for
        const marker = ClassifyFailure(message);

        if (marker) {
            core.notice(`Retryable failure: ${message}`, { title: marker });
        }

        core.setFailed(message);
    }
}

/**
 * Create a project with the official Unity CLI from the first template it offers that matches.
 * @param unityEditor The Unity Editor to create the project with.
 * @param projectDirectory The directory the project is created in.
 * @param projectName The name of the project folder.
 * @param projectPath The path of the created project.
 * @param prefixes The template id prefixes, in order of preference.
 */
async function createProject(unityEditor: UnityEditor, projectDirectory: string, projectName: string, projectPath: string, prefixes: string[]): Promise<void> {
    const cli = await UnityCli.Get();
    await registerEditor(cli, unityEditor);

    const templates = await cli.ListTemplates(unityEditor.version.version);
    core.startGroup('Available Unity Project Templates:');

    for (const template of templates) {
        core.info(`  - ${template}`);
    }

    core.endGroup();

    if (prefixes.length === 0) {
        throw new Error(`No template-name given. Available templates: ${templates.join(', ')}`);
    }

    const templateId = MatchTemplate(templates, prefixes);

    if (!templateId) {
        throw new Error(`No Unity ${unityEditor.version.version} template matches ${prefixes.join(', ')}. Available templates: ${templates.join(', ')}`);
    }

    core.info(`Using Unity template:\n  > ${templateId}`);
    core.info(`Creating Unity project at:\n  > ${projectPath}`);
    // the Unity CLI creates the project folder but needs its parent to exist, which the editor's -createProject created
    await fs.promises.mkdir(path.resolve(projectDirectory), { recursive: true });
    const args = [
        'projects', 'create', projectName,
        '--path', path.resolve(projectDirectory),
        '--editor-version', unityEditor.version.version,
        '--template', templateId,
        '--no-cloud',
        '--non-interactive',
    ];
    const result = await cli.Run(args, { stream: true });

    if (result.exitCode !== 0) {
        // the output goes into the message, so a failure a rerun can clear is classified from it
        throw new Error(`unity ${args.join(' ')} failed with exit code ${result.exitCode}\n${`${result.stdout}\n${result.stderr}`.trim()}`);
    }

    if (!fs.existsSync(path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt'))) {
        throw new Error(`The Unity CLI did not create a project at ${projectPath}`);
    }
}

/**
 * Make the editor known to the official Unity CLI, which only creates projects with editors it has registered.
 * @param cli The official Unity CLI.
 * @param unityEditor The Unity Editor to register.
 */
async function registerEditor(cli: UnityCli, unityEditor: UnityEditor): Promise<void> {
    const version = unityEditor.version.version;
    const { exitCode, envelope } = await cli.RunJson(['editors', 'path', version]);
    const registeredPath = exitCode === 0 && envelope?.success !== false ? FindAbsolutePath(envelope?.data) : undefined;

    if (registeredPath) {
        core.debug(`Unity ${version} is registered at ${registeredPath}`);
        return;
    }

    core.info(`Registering Unity ${version} with the Unity CLI`);
    await cli.Exec(['editors', 'add', unityEditor.editorPath, '--non-interactive']);
}

/**
 * Create a project with an editor the official Unity CLI cannot create projects with, from a template bundled with the editor.
 * @param unityEditor The Unity Editor to create the project with.
 * @param projectPath The path of the created project.
 * @param prefixes The template id prefixes, in order of preference.
 */
async function createLegacyProject(unityEditor: UnityEditor, projectPath: string, prefixes: string[]): Promise<void> {
    const templates = GetBundledTemplates(unityEditor);
    let templatePath: string | undefined = undefined;

    if (templates.length > 0) {
        core.startGroup('Bundled Unity Project Templates:');

        for (const template of templates) {
            core.info(`  - ${path.basename(template)}`);
        }

        core.endGroup();
        const templateId = MatchTemplate(templates.map(GetBundledTemplateId), prefixes);
        templatePath = templates.find(t => GetBundledTemplateId(t) === templateId);
    }

    if (templatePath) {
        core.info(`Using Unity template at path:\n  > ${templatePath}`);
    } else {
        core.info(`Unity ${unityEditor.version.version} has no bundled template that matches, so the project is created without one`);
    }

    core.info(`Creating Unity project at:\n  > ${projectPath}`);
    const logPath = unityEditor.GenerateLogFilePath(projectPath, 'create-unity-project');

    const args: string[] = [
        `-logFile`, logPath,
        '-quit',
        '-createProject', projectPath,
    ];

    if (templatePath) {
        args.push('-cloneFromTemplate', templatePath);
    }

    try {
        await unityEditor.Run({ args: [...args] });
    } catch (error) {
        // some editors crash while shutting down after the project is already created
        if (!projectCreated(projectPath, logPath)) {
            throw error;
        }

        core.warning(`Unity exited with an error after creating the project, which is kept:\n${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Whether the editor finished creating the project: it wrote the project version and reached its batchmode quit.
 * @param projectPath The path of the created project.
 * @param logPath The editor log of the create run.
 */
function projectCreated(projectPath: string, logPath: string): boolean {
    try {
        return fs.existsSync(path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt')) &&
            fs.readFileSync(logPath, 'utf8').includes('Batchmode quit successfully invoked');
    } catch {
        return false;
    }
}

main();
