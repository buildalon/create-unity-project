# create-unity-project

[![Discord](https://img.shields.io/discord/939721153688264824.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/VM9cWJ9rjH) [![marketplace](https://img.shields.io/static/v1?label=&labelColor=505050&message=Buildalon%20Actions&color=FF1E6F&logo=github-actions&logoColor=0076D6)](https://github.com/marketplace?query=buildalon)

A GitHub Action to create a new Unity Project using a predefined template package.

## How to use

### Requirements

> [!IMPORTANT]
> This action requires that the Unity Editor is installed on the runner.
>
> You can use [`unity-setup`](https://github.com/buildalon/unity-setup) action to install Unity Editor before using this action.

- `UNITY_EDITOR_PATH` environment variable must be set to the path of the Unity Editor executable.

> [!IMPORTANT]
> This action requires an active Unity license be available on the runner.
>
> You can use [`activate-unity-license`](https://github.com/buildalon/activate-unity-license) action to activate the Unity license before using this action.

- A license activation for the Unity Editor must also be completed before using this action.

### workflow

```yaml
steps:
  - uses: buildalon/create-unity-project@v2
    with:
      project-name: Test Project
      project-directory: ./Unity Project
      template-name: com.unity.template.3d(-cross-platform)?
```

### inputs

| name | description | required |
| ---- | ----------- | -------- |
| `project-name` | The name of the Unity project to create. | true |
| `project-directory` | The directory where the Unity project will be created.  | Defaults to the root of the workspace. |
| `template-name` | The name of the template package to use for creating the Unity project. | Default: `com.unity.template.3d(-cross-platform)?` |

> [!NOTE]
> `template-name` supports regex patterns, allowing you to match multiple template packages. For example, `com.unity.template.3d(-cross-platform)?` will match both `com.unity.template.3d` and `com.unity.template.3d-cross-platform`.

### outputs

- `project-path`: The path to the created Unity project. This is the absolute path to the project directory.
