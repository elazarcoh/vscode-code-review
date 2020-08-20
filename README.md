# vscode-code-review

[![VSCode Marketplace](https://vsmarketplacebadge.apphb.com/version/d-koppenhagen.vscode-code-review.svg)](https://marketplace.visualstudio.com/items?itemName=d-koppenhagen.vscode-code-review)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=102)](https://github.com/ellerbrock/open-source-badge/)

This extension allows you to create a code review file you can hand over to a customer.

<hr>

- [vscode-code-review](#vscode-code-review)
- [Features](#features)
  - [create review notes](#create-review-notes)
  - [export created notes as HTML](#export-created-notes-as-html)
  - [Export for Issue Tracking System](#export-for-issue-tracking-system)
- [Extension Settings](#extension-settings)
- [Keybindings](#keybindings)
- [The review approach](#the-review-approach)

<hr>

## Features

### create review notes

Simply right click somewhere in the opened file and choose the option "Code Review: Add Note".
You will be prompted for your note you wanna add.
A file `code-review.csv` will be created containing your comments and the file and line references.

The result will look like this:

```csv
sha,filename,url,lines,title,comment,priority,additional
"b45d2822d6c87770af520d7e2acc49155f0b4362","/test/a.txt","https://github.com/d-koppenhagen/vscode-code-review/tree/b45d2822d6c87770af520d7e2acc49155f0b4362/test/a.txt","1:2-4:3","foo","this should be refactored","Complexity",1,"see http://foo.bar"
"b45d2822d6c87770af520d7e2acc49155f0b4362","/test/b.txt","https://github.com/d-koppenhagen/vscode-code-review/tree/b45d2822d6c87770af520d7e2acc49155f0b4362/test/b.txt","1:0-1:4|4:0-4:3","bar","wrong format","Best Practices",1,""
```

The line column indicates an array of selected ranges or cursor positions separated by a `|` sign.
E.g. `"1:0-1:4|4:0-4:3"` means that the comment is related to the range marked from line 1 position 0 to line 1 position 4 and line 4 position 0 to line 4 position 3.

![Demo](./images/demo.gif)

### export created notes as HTML

Once you finished your review and added your notes, you can export the results as an HTML report.
Therefore open the [VSCode Command Palette](https://code.visualstudio.com/docs/getstarted/tips-and-tricks#_command-palette) (macOS: ⇧+⌘+P, others: ⇧+Ctrl+P) and search for "Code Review":

![Code Review: Export as HTML](./images/export.png)

#### Default template

When you choose to generate the report using the default template, it will look like this in the end:

![Code Review HTML Export: Default Template](./images/default-template.png)

> You can define a path to a custom template that's used by default when running this command.
> Check out the [Extension Setting 'defaultTemplatePath'](#extension-settings) for further information.

#### Custom handlebars template

You can also choose to export the HTML report by using a custom [Handlebars](https://handlebarsjs.com/) template.
One you choose this option you cot prompted to choose the template file (file extension must be either `*.hbs`, `*.handlebars`, `*.html` or `*.htm`)

![Code Review HTML Export: Use a custom Handlebars template](./images/template.png)

The used structure to fill the template placholders is an array of [`ReviewFileExportSection`](https://github.com/d-koppenhagen/vscode-code-review/blob/master/src/interfaces.ts#L31-L44).

Check out the example default template file
[`template.default.hbs`](https://github.com/d-koppenhagen/vscode-code-review/blob/master/src/template.default.hbs), to see how your template should basically look like.

### Export for Issue Tracking System

#### export created notes as GitLab importable CSV file

Once you finished your code review, you can export the results to a formatted csv file that's [importable into Gitlab issues](https://docs.gitlab.com/ee/user/project/issues/csv_import.html).

![Code Review GitLab importable CSV export](./images/export-gitlab.png)

Once exported, you can import the file in the GitLab project

![GitLab import CSV file](./images/gitlab-import.png)

#### export created notes as GitHub importable CSV file

You can export the code review results to a formatted csv file that's [importable into GitHub by using `github-csv-tools`](https://github.com/gavinr/github-csv-tools).

![Code Review GitLab importable CSV export](./images/export-github.png)

#### export created notes as JIRA importable CSV file

You can also export the notes as a CSV file to [import them into your JIRA issue tracking system](https://confluence.atlassian.com/adminjiracloud/importing-data-from-csv-776636762.html).

![Code Review JIRA importable CSV export](./images/export-jira.png)

After exporting, you can import the file in your JIRA instance and probably map the props / ignore what you don't need:

![JIRA: import issues from a CSV file](./images/jira-import.png)
![JIRA: map CSV file props](./images/jira-import-map.png)

## Extension Settings

The following settings can be adjusted via the configuration file `.vscode/settings.json` or globally when configuring vscode.
The listing below shows the default configuration:

![Visual Studio Code - Code Review Extension Settings](./images/extension-settings.png)

### `code-review.filename`

The filename for the `*.csv` file that stores all comments.
By default `"code-review"` is used.

```json
{
  "code-review.filename": "my-review-file"
}
```

### `code-review.baseUrl`

The base-URL is used to build a full link to the file.
It will be appended with the git SHA if available followed by the relative path of the file and the selected lines as an anker.
This setting is skipped when the setting `code-review.customUrl` is defined which is more configurable.

```json
{
  "code-review.baseUrl": "https://github.com/foo/bar/blob"
}
```

This setting would lead into something like this: `https://github.com/foo/bar/blob/b0b4...0175/src/file.txt#L12-L19`.

### `code-review.customUrl`

The custom URL is used to build a full link to the file.
The following placeholders are available:
- `{sha}`: insert the SHA ref for the file
- `{file}`: insert the file name/path
- `{start}`: insert the start of the lines selection as an anker
- `{end}`: insert the end of the lines selection as an anker

```json
{
  "code-review.customUrl": "https://gitlab.com/foo/bar/baz/-/blob/{sha}/src/{file}#L{start}-{end}"
}
```

This setting would lead into something like this: `https://gitlab.com/foo/bar/baz/-/blob/b0b4...0175/src/file.txt#L12-19`

### `code-review.groupBy`

This setting is used when [generating a report](#export-created-notes-as-html).
The comments will be grouped by either:
- `filename`: default, group by filename
- `priority`: grouping by priorities
- `category`: grouping by the used categories

```json
{
  "code-review.groupBy": "category"
}
```

### `code-review.categories`

Here you can define the categories that will be available for selection when you create comments.

```json
{
  "code-review.categories": [
      "Architecture",
      "Best Practices",
      ...
   ],
}
```

### `code-review.reportWithCodeSelection`

Define weather to include the code selection(s) in generated reports or not.

```json
{
  "code-review.reportWithCodeSelection": true
}
```

> Attention! The code included in the report will be BASE64 encoded in order to prevent breaking report generation by unescaped characters that will be accidentally interpreted.
You can decode this e.g. by using a JS script at the end of the handlebars report template as [shown here](./src/template.default.hbs#L143-L149).

### `code-review.defaultTemplatePath`

The path to a default Handlebars template to be used for HTML default export.
The template is used by default when choosing [_'Export as HTML with default template'_](#export-created notes-as-html) extension command.
If not set, the out-of-the-box template provided by this extension is used.
The configured value must be the full path to the Handlebars template file.

```json
{
  "code-review.defaultTemplatePath": "/Users/my-user/my-code-review-template.hbs"
}
```

## Keybindings

To easily add a *new* comment, you can use the keybinding combination `ctrl` + ⇧ + `n`.

## The review approach

If you got a customer request for doing a code review you will ideally receive read access to it's github / gitlab repoistory or similar.
To create a code review with a report you should install this extension and go on with the following steps:

- Download / clone the customer code and checkout the correct branch
- Open the project in vscode
- [Configure th `baseURL` option](#extension-settings) with the remote URL
  - this will cause that the link in the report is generate with the correct target including SHA, file and line reference
- [Start creating your review notes](#create-review-notes).
- [Export the report](#export-created-notes-as-html).
  - [Probably create an own template first](#custom-handlebars-template)
- Send it to the customer or [import the notes in your issue tracking system](#export-for-issue-tracking-system) and make the customer happy ♥️

**Enjoy!**
