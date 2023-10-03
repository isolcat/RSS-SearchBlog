const vscode = require("vscode");
const axios = require("axios");
const xmlParser = require("fast-xml-parser");

const RSS_LINKS_CONFIG_KEY = 'allblog.rssLinks';
const RSS_LINK_REGEX = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/;

async function activate(context) {
	let rssLinks = vscode.workspace.getConfiguration().get(RSS_LINKS_CONFIG_KEY, {});

	async function parseArticles(link) {
		const response = await axios.get(link);
		//解析RSS链接中的文章
		const articles = xmlParser.parse(response.data).rss.channel.item;
		return articles;
	}

	async function getArticleContent(link, customName) {
		const articles = await parseArticles(link);

		// 创建文章列表以供用户选择
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

			//自定义高度
			const heightInput = await vscode.window.showInputBox({
				prompt: 'Enter the height of the window (in px)',
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
			...Object.keys(rssLinks).map(link => ({ label: rssLinks[link], link, isNew: false }))
		];

		const selectedChoice = await vscode.window.showQuickPick(choiceItems, {
			placeHolder: 'Select an RSS link or add a new one'
		});

		if (selectedChoice) {
			if (selectedChoice.isNew) {
				const newLink = await vscode.window.showInputBox({
					prompt: 'Enter RSS link',
					validateInput: (text) => {
						if (!RSS_LINK_REGEX.test(text)) {
							return 'Please enter a valid RSS link (starting with http:// or https://)';
						}
						return null;
					}
				});

				if (newLink) {
					const customName = await vscode.window.showInputBox({
						prompt: 'Enter a custom name for this RSS link'
					});

					if (customName) {
						// 检查重复的自定义名称
						const duplicateCustomName = Object.values(rssLinks).includes(customName);
						if (duplicateCustomName) {
							vscode.window.showErrorMessage('This custom name is already in use. Please choose a different name.');
							return;
						}

						// 添加新的RSS链接和对应的自定义名字
						rssLinks[newLink] = customName;
						// 订阅信息会保存在用户的本地配置中
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
