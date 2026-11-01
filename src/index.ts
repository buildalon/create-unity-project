import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import { UnityEditor } from '@rage-against-the-pixel/unity-cli';
import { ClassifyFailure } from '@rage-against-the-pixel/unity-cli/dist/failure-markers';
import { GetAvailableTemplates, GetTemplatePath } from './templates';

async function main() {
    try {
        if (!process.env.UNITY_EDITOR_PATH) {
            throw new Error('UNITY_EDITOR_PATH environment variable must be set!');
        }

        const unityEditor = new UnityEditor(process.env.UNITY_EDITOR_PATH);
        core.info(`Using Unity Editor at path:\n  > ${unityEditor.editorPath}`);

        let templatePath: string | undefined = undefined;

        if (unityEditor.version.isGreaterThan('2019.0.0')) {
            const availableTemplates = GetAvailableTemplates(unityEditor);
            core.startGroup('Available Unity Project Templates:');

            for (const template of availableTemplates) {
                core.info(`  - ${path.basename(template)}`);
            }

            core.endGroup();
            templatePath = GetTemplatePath(availableTemplates, core.getInput('template-name'));
            core.info(`Using Unity template at path:\n  > ${templatePath}`);
        } else {
            core.info('Unity Project Templates are not supported for Unity versions prior to 2019');
        }

        const projectNameInput = core.getInput('project-name', { required: true });
        const projectDirectoryInput = core.getInput('project-directory') || process.cwd();
        const projectPath = `${projectDirectoryInput}/${projectNameInput}`;
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
            // some editors, such as 6000.0 on Linux, crash while shutting down after the project is already created
            if (!projectCreated(projectPath, logPath)) {
                throw error;
            }

            core.warning(`Unity exited with an error after creating the project, which is kept:\n${error instanceof Error ? error.message : String(error)}`);
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