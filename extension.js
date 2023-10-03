const vscode = require("vscode");
const axios = require("axios");
const xmlParser = require("fast-xml-parser");

const RSS_LINKS_CONFIG_KEY = 'allblog.rssLinks';

async function activate(context) {
	// 获取保存的RSS链接列表
	let rssLinks = vscode.workspace.getConfiguration().get(RSS_LINKS_CONFIG_KEY, []);

	// 解析RSS文章
	async function parseArticles(link) {
		const response = await axios.get(link);
		const articles = xmlParser.parse(response.data).rss.channel.item;
		return articles;
	}

	async function getArticleContent(link) {
		const articles = await parseArticles(link);

		// 生成文章列表
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

			// 显示滑块，让用户可以自定义窗口高度
			const heightInput = await vscode.window.showInputBox({
				prompt: 'Enter the height of the window (in pixels)',
				placeHolder: '500' // Default height
			});

			const webViewPanel = vscode.window.createWebviewPanel(
				'blogWebView',
				selectedArticle.label, // Use the selected article title as the panel title
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
			...rssLinks.map(link => ({ label: link.name, isNew: false }))
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

					const newRssLink = {
						name: customName || newLink, // Use custom name if provided, otherwise use the link itself
						url: newLink
					};

					// 统一数据结构为对象数组
					rssLinks.push(newRssLink);
					vscode.workspace.getConfiguration().update(RSS_LINKS_CONFIG_KEY, rssLinks, vscode.ConfigurationTarget.Global);
					await getArticleContent(newLink);
				}
			} else {
				// 用户选择了已有的RSS链接
				await getArticleContent(selectedChoice.label);
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
