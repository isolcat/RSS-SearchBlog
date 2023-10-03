const vscode = require("vscode");
const axios = require("axios");
const xmlParser = require("fast-xml-parser");

const RSS_LINKS_CONFIG_KEY = 'allblog.rssLinks';

async function activate(context) {
	let rssLinks = vscode.workspace.getConfiguration().get(RSS_LINKS_CONFIG_KEY, {});

	async function parseArticles(link) {
		const response = await axios.get(link);
		const articles = xmlParser.parse(response.data).rss.channel.item;
		return articles;
	}

	async function getArticleContent(link, customName) {
		const articles = await parseArticles(link);

		const articleList = articles.map((article, index) => ({
			label: article.title,
			description: article.description,
			link: article.link,
			index
		}));

		const selectedArticle = await vscode.window.showQuickPick(articleList, {
			placeHolder: 'Select an article to read'
		});

		if (selectedArticle) {
			const { link } = selectedArticle;

			const heightInput = await vscode.window.showInputBox({
				prompt: 'Enter the height of the window (in pixels)',
				placeHolder: '500'
			});

			const webViewPanel = vscode.window.createWebviewPanel(
				'blogWebView',
				customName, // Use the custom name as the title
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			let height = parseInt(heightInput) || 500;
			webViewPanel.webview.html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
              }
            </style>
          </head>
          <body>
            <iframe src="${link}" width="100%" height="${height}px"></iframe>
          </body>
        </html>
      `;
		}
	}

	let disposable = vscode.commands.registerCommand('allblog.searchBlog', async () => {
		const choiceItems = [
			{ label: 'Add new RSS link', isNew: true },
			...Object.keys(rssLinks).map(link => ({ label: rssLinks[link], link: link, isNew: false }))
		];

		const selectedChoice = await vscode.window.showQuickPick(choiceItems, {
			placeHolder: 'Select an RSS link or add a new one'
		});

		if (selectedChoice) {
			if (selectedChoice.isNew) {
				const newLink = await vscode.window.showInputBox({
					prompt: 'Enter RSS link'
				});

				if (newLink) {
					const customName = await vscode.window.showInputBox({
						prompt: 'Enter a custom name for this RSS link'
					});

					if (customName) {
						// Check for duplicate custom names
						const duplicateCustomName = Object.values(rssLinks).includes(customName);
						if (duplicateCustomName) {
							vscode.window.showErrorMessage('This custom name is already in use. Please choose a different name.');
							return;
						}

						// 添加新的RSS链接和对应的自定义名字
						rssLinks[newLink] = customName;
						vscode.workspace.getConfiguration().update(RSS_LINKS_CONFIG_KEY, rssLinks, vscode.ConfigurationTarget.Global);
						await getArticleContent(newLink, customName);
					}
				}
			} else {
				await getArticleContent(selectedChoice.link, selectedChoice.label);
			}
		}
	});

	context.subscriptions.push(disposable);
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
};
