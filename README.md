# Buildalon create unity project from hub template

[![Discord](https://img.shields.io/discord/939721153688264824.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/VM9cWJ9rjH) [![marketplace](https://img.shields.io/static/v1?label=&labelColor=505050&message=Buildalon%20Actions&color=FF1E6F&logo=github-actions&logoColor=0076D6)](https://github.com/marketplace?query=buildalon)

A GitHub Action to create a new Unity Project from a Unity project template, using the official [Unity CLI](https://docs.unity.com/en-us/cli).

## How to use

### Requirements

> [!IMPORTANT]
> This action requires that the Unity Editor is installed on the runner.
>
> You can use [`unity-setup`](https://github.com/buildalon/unity-setup) action to install Unity Editor before using this action.

***`UNITY_EDITOR_PATH` environment variable must be set to the path of the Unity Editor executable.***

> [!IMPORTANT]
> This action requires an active Unity license be available on the runner.
>
> You can use [`activate-unity-license`](https://github.com/buildalon/activate-unity-license) action to activate the Unity license before using this action.

***A license activation for the Unity Editor must also be completed before using this action.***

### workflow

```yaml
steps:
  - uses: buildalon/create-unity-project@v4
    with:
      project-name: Test Project
      project-directory: ./Unity Project
      template-name: com.unity.template.3d, com.unity.template.urp-blank
```

### inputs

| name | description | required |
| ---- | ----------- | -------- |
| `project-name` | The name of the Unity project to create. | true |
| `project-directory` | The directory where the Unity project will be created.  | Defaults to the root of the workspace. |
| `template-name` | A comma, newline or `\|` separated list of template id prefixes, in order of preference. | Default: `com.unity.template.3d, com.unity.template.urp-blank` |

> [!NOTE]
> The action lists the templates the official Unity CLI offers for the editor (`unity templates --editor-version <version>`) and uses the first entry of `template-name` that matches one, either exactly or as the start of its id. Newer editors such as 7000.0 have no `com.unity.template.3d`, so the default falls back to `com.unity.template.urp-blank`. When no entry matches, the action fails and lists the available template ids.

### outputs

- `project-path`: The path to the created Unity project, `<project-directory>/<project-name>`. It is relative when `project-directory` is relative.

### notes

- Unity 2019.1 and newer create the project with `unity projects create`. The editor at `UNITY_EDITOR_PATH` is registered with the Unity CLI first if it is not already.
- Older editors create the project with the editor's `-createProject`, from a template bundled with the editor that matches `template-name`, or without a template when none does.
- v3 regex patterns are no longer supported, but v3 values keep working: a top-level `|` separates entries like a comma, and an entry such as `com.unity.template.3d(-cross-platform)?` is matched by its leading id, `com.unity.template.3d`, with a warning.
- When creation fails for a reason a rerun can fix, the action adds a notice titled `unity-license-exhausted` or `unity-transient-failure` for [retry-failed-jobs](https://github.com/buildalon/retry-failed-jobs).
