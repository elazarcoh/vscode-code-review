// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import {
  commands,
  workspace,
  window,
  ExtensionContext,
  WorkspaceFolder,
  Uri,
  Range,
  ViewColumn,
  QuickPickItem,
} from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CheckFlag, FileGenerator } from './file-generator';
import { ReviewCommentService } from './review-comment';
import { getWorkspaceFolder, rangeFromStringDefinition } from './utils/workspace-util';
import { WebViewComponent } from './webview';
import { ExportFactory } from './export-factory';
import { CommentView, CommentsProvider } from './comment-view';
import { ReviewFileExportSection } from './interfaces';
import { CsvEntry } from './model';
import { CommentListEntry } from './comment-list-entry';
import { ImportFactory, ConflictMode } from './import-factory';

const checkForCodeReviewFile = (fileName: string) => {
  commands.executeCommand('setContext', 'codeReview:displayCodeReviewExplorer', fs.existsSync(fileName));
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  const workspaceRoot: string = getWorkspaceFolder(workspace.workspaceFolders as WorkspaceFolder[]);
  const generator = new FileGenerator(workspaceRoot);
  generator.check(CheckFlag.format | CheckFlag.migrate);
  const webview = new WebViewComponent(context);

  const defaultConfigurationTemplatePath = workspace
    .getConfiguration()
    .get('code-review.defaultTemplatePath') as string;
  const defaultTemplate = defaultConfigurationTemplatePath
    ? Uri.file(defaultConfigurationTemplatePath)
    : Uri.parse(context.asAbsolutePath(path.join('dist', 'template.default.hbs')));

  const exportFactory = new ExportFactory(context, workspaceRoot, generator);
  const importFactory = new ImportFactory(workspaceRoot, exportFactory.inputFile, generator);

  /**
   * register comment view
   */
  const commentProvider = new CommentsProvider(context, exportFactory);

  // refresh comment view on manual changes in the review file
  const fileWatcher = workspace.createFileSystemWatcher(`**/${generator.reviewFileName}`);
  checkForCodeReviewFile(generator.reviewFilePath);
  fileWatcher.onDidChange(() => {
    commentProvider.refresh();
  });
  fileWatcher.onDidCreate(() => {
    commentProvider.refresh();
    checkForCodeReviewFile(generator.reviewFilePath);
  });
  fileWatcher.onDidDelete(() => {
    commentProvider.refresh();
    checkForCodeReviewFile(generator.reviewFilePath);
  });

  // Refresh comment view on git switch
  const gitDirectory = (workspace.getConfiguration().get('code-review.gitDirectory') as string) ?? '.';
  const gitHeadPath = path.resolve(gitDirectory, '.git/HEAD');
  const gitWatcher = workspace.createFileSystemWatcher(`**${gitHeadPath}`);
  gitWatcher.onDidChange(() => {
    exportFactory.refreshFilterByCommit();
    commentProvider.refresh();
  });

  // Refresh comment view on file focus
  window.onDidChangeActiveTextEditor((_) => {
    if (exportFactory.refreshFilterByFilename()) {
      commentProvider.refresh();
    }
  });

  // instantiate comment view
  new CommentView(commentProvider);

  // create a new file if not already exist
  const commentService = new ReviewCommentService(generator.reviewFilePath, workspaceRoot);

  /**
   * register comment panel web view
   */
  const addNoteRegistration = commands.registerCommand('codeReview.addNote', () => {
    if (!window.activeTextEditor?.selection) {
      window.showErrorMessage(`No selection made. Please select something you want to add a comment to and try again.`);
      return;
    }
    // Execute every time a comment will be added to check file format
    if (!generator.create()) {
      return;
    }

    webview.addComment(commentService);
    commentProvider.refresh();
  });

  const setFilterByCommit = (state: boolean) => {
    exportFactory.setFilterByCommit(state);
    commentProvider.refresh();
  };

  const filterByCommitEnableRegistration = commands.registerCommand('codeReview.filterByCommitEnable', () => {
    setFilterByCommit(true);
  });

  const filterByCommitDisableRegistration = commands.registerCommand('codeReview.filterByCommitDisable', () => {
    setFilterByCommit(false);
  });

  const setFilterByFilename = (state: boolean) => {
    exportFactory.setFilterByFilename(state);
    commentProvider.refresh();
  };

  const filterByFilenameEnableRegistration = commands.registerCommand('codeReview.filterByFilenameEnable', () => {
    setFilterByFilename(true);
  });

  const filterByFilenameDisableRegistration = commands.registerCommand('codeReview.filterByFilenameDisable', () => {
    setFilterByFilename(false);
  });

  /**
   * delete an existing comment
   */
  const deleteNoteRegistration = commands.registerCommand('codeReview.deleteNote', (entry: CommentListEntry) => {
    if (!generator.check()) {
      return;
    }

    webview.deleteComment(commentService, entry);
    commentProvider.refresh();
  });

  /**
   * allow users to export the report as HTML using the default output
   */
  const exportAsHtmlWithDefaultTemplateRegistration = commands.registerCommand(
    'codeReview.exportAsHtmlWithDefaultTemplate',
    () => {
      exportFactory.exportForFormat('html', defaultTemplate);
    },
  );

  /**
   * allow users to export the report as HTML using a specific handlebars template
   */
  const exportAsHtmlWithHandlebarsTemplateRegistration = commands.registerCommand(
    'codeReview.exportAsHtmlWithHandlebarsTemplate',
    () => {
      window
        .showOpenDialog({
          canSelectFolders: false,
          canSelectFiles: true,
          canSelectMany: false,
          openLabel: 'Use template',
          filters: {
            Template: ['hbs', 'html', 'htm', 'handlebars'],
          },
        })
        .then((files) => {
          const template = files?.length ? files[0] : undefined;
          exportFactory.exportForFormat('html', template ?? defaultTemplate);
        });
    },
  );

  /**
   * allow users to export the report as GitLab importable CSV file
   */
  const exportAsGitLabImportableCsvRegistration = commands.registerCommand(
    'codeReview.exportAsGitLabImportableCsv',
    () => {
      exportFactory.exportForFormat('gitlab');
    },
  );

  /**
   * allow users to export the report as GitHub importable CSV file
   * @see https://github.com/gavinr/github-csv-tools
   */
  const exportAsGitHubImportableCsvRegistration = commands.registerCommand(
    'codeReview.exportAsGitHubImportableCsv',
    () => {
      exportFactory.exportForFormat('github');
    },
  );

  /**
   * allow users to export the report as JIRA importable CSV file
   */
  const exportAsJiraImportableCsvRegistration = commands.registerCommand('codeReview.exportAsJiraImportableCsv', () => {
    exportFactory.exportForFormat('jira');
  });

  /**
   * allow users to export the report as JSON file
   */
  const exportAsJsonRegistration = commands.registerCommand('codeReview.exportAsJson', () => {
    exportFactory.exportForFormat('json');
  });

  /**
   * allow users to import comments from a JSON file
   */
  const importFromJsonRegistration = commands.registerCommand('codeReview.importFromJson', () => {
    // File selection
    window
      .showOpenDialog({
        canSelectFolders: false,
        canSelectFiles: true,
        canSelectMany: false,
        openLabel: 'Select comments file to import',
        filters: {
          Template: ['json'],
        },
      })
      .then((files) => {
        const filename = files?.length ? files[0] : undefined;
        if (filename) {
          const mode = workspace.getConfiguration().get('code-review.importConflictMode') as string;
          if (mode !== '') {
            importFactory.importCommentsFromFile(filename!.fsPath, mode as ConflictMode).then((result) => {
              if (result) {
                commentProvider.refresh();
              }
            });
          } else {
            // Select the import conflict mode
            class PickItem implements QuickPickItem {
              constructor(
                public mode: ConflictMode,
                public label: string,
                public description?: string | undefined,
                public detail?: string | undefined,
                public picked?: boolean | undefined,
                public alwaysShow?: boolean | undefined,
              ) {}
            }

            window
              .showQuickPick<PickItem>(
                [
                  {
                    label: 'Skip',
                    description:
                      'In case of conflict, the existing comment will be kept and the imported one will be ignored.',
                    alwaysShow: true,
                    mode: ConflictMode.skipImported,
                  } as PickItem,
                  {
                    label: 'Overwrite',
                    description: 'In case of conflict, the existing comment will be replaced with the imported one.',
                    alwaysShow: true,
                    mode: ConflictMode.replaceWithImported,
                  } as PickItem,
                  {
                    label: 'Clone',
                    description: 'In case of conflict, both the existing and the imported comments will be kept.',
                    alwaysShow: true,
                    mode: ConflictMode.importCopy,
                  } as PickItem,
                ],
                {
                  canPickMany: false,
                  placeHolder: 'Select the import conflict mode',
                },
              )
              .then((item) => {
                if (item) {
                  importFactory.importCommentsFromFile(filename!.fsPath, item.mode).then((result) => {
                    if (result) {
                      commentProvider.refresh();
                    }
                  });
                }
              });
          }
        }
      });
  });

  const openSelectionRegistration = commands.registerCommand(
    'codeReview.openSelection',
    (fileSection: ReviewFileExportSection, csvRef?: CsvEntry) => {
      if (!generator.check()) {
        return;
      }

      const filePath = path.join(workspaceRoot, fileSection.group);
      workspace.openTextDocument(filePath).then(
        (doc) => {
          window.showTextDocument(doc, ViewColumn.One).then((textEditor) => {
            if (csvRef) {
              const rangesStringArray = csvRef.lines.split('|');
              const ranges: Range[] = rangesStringArray.map((range) => rangeFromStringDefinition(range));
              textEditor.revealRange(ranges[0]);
              webview.editComment(commentService, ranges, csvRef);
            }
          });
        },
        (err) => {
          const msg = `Cannot not open file: '${filePath}': File does not exist.`;
          window.showErrorMessage(msg);
          console.log(msg, err);
        },
      );
    },
  );

  /**
   * push all registration into subscriptions
   */
  context.subscriptions.push(
    addNoteRegistration,
    deleteNoteRegistration,
    filterByCommitEnableRegistration,
    filterByCommitDisableRegistration,
    filterByFilenameEnableRegistration,
    filterByFilenameDisableRegistration,
    exportAsHtmlWithDefaultTemplateRegistration,
    exportAsHtmlWithHandlebarsTemplateRegistration,
    exportAsGitLabImportableCsvRegistration,
    exportAsGitHubImportableCsvRegistration,
    exportAsJiraImportableCsvRegistration,
    exportAsJsonRegistration,
    importFromJsonRegistration,
    openSelectionRegistration,
    gitWatcher,
    fileWatcher,
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
