const vscode = require("vscode");
const axios = require("axios");
const xmlParser = require("fast-xml-parser");

const RSS_LINKS_CONFIG_KEY = 'allblog.rssLinks';
const RSS_LINK_REGEX = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/;

// 记录每个 RSS 的最新文章链接
const latestArticleLinks = {};

// 定时检查 RSS 更新的时间间隔（毫秒）
const RSS_CHECK_INTERVAL = 3600000; // 1小时

async function activate(context) {
	let rssLinks = context.globalState.get(RSS_LINKS_CONFIG_KEY, {});

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

	// 定时检查 RSS 更新
	setInterval(async () => {
		for (const rssLink in rssLinks) {
			const response = await axios.get(rssLink);
			const articles = xmlParser.parse(response.data).rss.channel.item;

			// 获取当前 RSS 的最新文章链接
			let latestArticleLink = latestArticleLinks[rssLink];
			if (!latestArticleLink) {
				latestArticleLink = articles[0].link; // 默认取第一篇文章
			}

			// 检查是否有新文章
			const newArticles = articles.filter(article => article.link !== latestArticleLink);
			if (newArticles.length > 0) {
				latestArticleLinks[rssLink] = newArticles[0].link; // 更新最新文章链接

				// 提示用户有新文章
				vscode.window.showInformationMessage(`${rssLinks[rssLink]} 更新了文章`);
			}
		}
	}, RSS_CHECK_INTERVAL);

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
						// 保存订阅信息到用户的本地
						context.globalState.update(RSS_LINKS_CONFIG_KEY, rssLinks);
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
