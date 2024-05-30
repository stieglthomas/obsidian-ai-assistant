import { create } from 'domain';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl } from 'obsidian';


interface MyPluginSettings {
	groq_key: string;
	llm_model: string;
	instruct_summary: string;
	temperature: number;
}


let manifest = require('./manifest.json');


let ai_models : Record<string, string> = {};

let DEFAULT_SETTINGS: MyPluginSettings = {
	groq_key: "",
	llm_model: "",
	instruct_summary: "Summarize the following text. Answer strictly in the input language",
	temperature: 0.8
}


async function updateAvalibaleModels(plugin: MyPlugin, groq_key?: string) {

	try{
		console.log("Updating Avaliable Models")
		groq_key = groq_key || plugin.settings.groq_key
		if (groq_key === "") {
			throw new Error("No API key provided")
		}

		const headers : Record<string, string> = {
			"Authorization": "Bearer " + groq_key,
			"Content-Type": "application/json"
		}

		let response = await requestUrl({
			url: "https://api.groq.com/openai/v1/models",
			method: "GET",
			headers: headers
		})

		for (let model of JSON.parse(response.text).data) {
			ai_models[model.id] = model.id
		}

		if(plugin.settings.llm_model == "") {
			plugin.settings.llm_model = ai_models["llama3-8b-8192"] || Object.keys(ai_models)[0]
		}
		
		return true

		
	} catch (e) {
		console.log(e.message)
		return false
	}
	
}

function openSettings(plugin: MyPlugin) {
	const setting = (plugin.app as any).setting;
	setting.open();
	setting.openTabById(manifest.id);
}


function setStatusBarText(plugin: MyPlugin) {
	let statusBarItem = plugin.addStatusBarItem()
	statusBarItem.setText(`${plugin.settings.llm_model} (${plugin.settings.temperature})`);
	statusBarItem.addEventListener("click", evt => {
		openSettings(this);
	});

}


export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {

		await this.loadSettings();

		if (this.settings.groq_key !== "") {
			if (!await updateAvalibaleModels(this)){
				new Notice("Error in fetching avaliable models")
				setInterval(async () => {
					if (!await updateAvalibaleModels(this)) {}
				}, 5 * 60 * 1000);
			}
		} else {
			this.addSettingTab(new KeylessSettingTab(this.app, this));
			return
		}

		setStatusBarText(this);


		const summarizer = new groq(this, this.settings.instruct_summary)

		// this.addCommand({
		// 	id: 'open-sample-modal-simple',
		// 	name: 'Open sample modal (simple)',
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	}
		// });

		this.addCommand({
			id: 'open-settings',
			name: 'Open Settings',
			callback: () => {
				openSettings(this)
			}
		});


		// this.addCommand({
		// 	id: "define-text",
		// 	name: "Define Text",
		// 	editorCallback: async (editor: Editor) => {
		// 		new Notice(editor.getSelection())
		// 	}
		// })


		this.addCommand({
			id: "test-ai",
			name: "Testing AI",
			editorCallback: async (editor: Editor) => {
				await summarizer.answer(editor)
			}
		})


		this.addSettingTab(new MainSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		setStatusBarText(this);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}


export class ApiKeyModal extends Modal {
	result: string;
	plugin: MyPlugin;
  
	constructor(app: App, plugin: MyPlugin) {
	  super(app);
	  this.plugin = plugin;
	}
  
	async onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h3", { text: "Enter Groq API-Key" })
		contentEl.createEl("p", { text: "You can get the API key from the " }).createEl("a", { text: "Groq website", href: "https://console.groq.com/keys" });
		
		this.result = this.plugin.settings.groq_key

		new Setting(contentEl)
		
		.setName("API Key")
		.addText((text) =>
			
			text.setValue(this.result)
				.onChange((value) => {
					this.result = value
				}));

		new Setting(contentEl)
			.addButton((btn) =>
				btn
				.setButtonText("Cancel")
				.onClick(() => {
					this.close();
				}))
			.addButton((btn) =>
				btn
				.setButtonText("Submit")
				.setCta()
				.onClick(async() => {
					if (this.result == "" || this.result.length < 20) {
						new Notice("Invalid API Key")
						return
					}

					if (!await updateAvalibaleModels(this.plugin, this.result)){
						new Notice("Unauthorized API Key")
						return
					}
					this.plugin.settings.groq_key = this.result;
					await this.plugin.saveSettings();
					this.close();
					new Notice("Reloading Plugin")
					this.plugin.unload()
					this.plugin.load()
				}))
			
	}
  
	onClose() {
	  let { contentEl } = this;
	  contentEl.empty();
	}
  }


declare module 'obsidian' {
	interface Editor {
		createCallout(callout: string, title: string, text: string): void;
	}
}

Editor.prototype.createCallout = function(callout: string, title: string, text: string) {
	console.log("Creating Callout")
	const cursor = this.getCursor();
	const lineBreak = cursor.ch === 0 ? '' : '\n\n';
	this.replaceSelection(`${lineBreak}> [!${callout}]- ${title}\n> ${text}\n\n`);
};



class MainSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.empty();
		containerEl.createEl("h3", { text: "AI-Assistant" })

		new Setting(containerEl)
			.setName('Groq API Key')
			.addButton(button => button
				.setButtonText('Update Key')
				.onClick(() => {
					new ApiKeyModal(this.app, this.plugin).open();
				})
			);
		

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Select the LLM model to use')
			.addDropdown(dropdown => dropdown
				// .addOptions(Object.entries(ai_models).reduce((acc, [key, value]) => {
				// 	acc[key] = value;
				// 	return acc;
				// }, {} as Record<string, string>))
				.addOptions(ai_models)
				.setValue(this.plugin.settings.llm_model)
				.onChange(async (value) => {
					this.plugin.settings.llm_model = value;
					await this.plugin.saveSettings();
				})
			);
		
		new Setting(containerEl)
			.setName('System Message')
			.setDesc('System Message for AI-Model')
			.addTextArea(textarea => textarea
				.setPlaceholder('Enter your system message')
				.setValue(this.plugin.settings.instruct_summary)
				.onChange(async (value) => {
					this.plugin.settings.instruct_summary = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Temperature')
			.setDesc('Temperature for AI-Model')
			.addSlider(slider => slider
				.setValue(this.plugin.settings.temperature)
				.setLimits(0, 2, 0.1)
				.onChange(async (value) => {
					this.plugin.settings.temperature = value;
					await this.plugin.saveSettings();
				})
			);
	}
}



class KeylessSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl("h3", { text: "AI-Assistant" })
		containerEl.createEl("p", { text: "To display avaliable LLM-models, please enter the API key. You can get the API key from the " }).createEl("a", { text: "Groq website", href: "https://console.groq.com/keys" });

		new Setting(containerEl)
			.setName('Groq API Key')
			.addButton(button => button
				.setButtonText('Enter Key')
				.onClick(() => {
					new ApiKeyModal(this.app, this.plugin).open();
				})
			);
	
	}
}





class groq {
	plugin: MyPlugin;
	ai_model: string;
	system_message: string;
	temprature: number;
	headers: Record<string, string>;

	constructor (plugin: MyPlugin, system_message: string) {
		this.plugin = plugin;
		this.system_message = system_message;
		this.updateSettings();
	}

	updateSettings() {
		this.ai_model = this.plugin.settings.llm_model;
		this.temprature = this.plugin.settings.temperature;
		this.headers = {
			"Authorization": "Bearer " + this.plugin.settings.groq_key,
			"Content-Type": "application/json"
		}
	}

	async answer(editor: Editor, input?: string, callout_name?: string) {
		callout_name = callout_name || "ai-summary"
		input = input || editor.getValue();
		let text = await this.ask(input)
		if (text === "") {
			return
		}
		editor.createCallout(callout_name, "AI Summary", await this.ask(input))
	}


	async ask(input: string) {
		this.updateSettings();
		let data = {
		"messages": [
			{
				"role": "system", 
				"content": this.system_message + "; If you have no answer, only respond with 'ERROR'"
			},
			{
				"role": "user", 
				"content": input
			}
		],
			"temperature": this.temprature,
			"model": this.ai_model
		}

		try {
			let response = await requestUrl({
				url: "https://api.groq.com/openai/v1/chat/completions",
				method: "POST",
				headers: this.headers,
				body: JSON.stringify(data)
			})

			let response_message = JSON.parse(response.text).choices[0].message.content
			response_message = JSON.parse(response.text)
			response_message = response_message.choices[0].message.content

			if (response_message === "ERROR") {
				throw new Error("No answer was found")
			}
			return response_message


		} catch (e) {
			console.log(e.message)
			new Notice("Error in asking the AI model")
			return ""
		}
	}
}
