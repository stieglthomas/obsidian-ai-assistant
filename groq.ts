import { App, Editor, requestUrl, Notice, Modal, Setting } from "obsidian";
import MyPlugin from "main";

export class Groq {
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
		editor.createCallout(callout_name, "AI Summary", text)
	}


	async ask(input: string, temperature?: number) {
		temperature = temperature || this.temprature
		this.updateSettings();
		let data = {
		"messages": [
			{
				"role": "system", 
				"content": `
					${this.system_message}\n
					${this.plugin.settings.instruct_general}\n
					If you have no answer, only respond with 'ERROR'\n
					Strictly Anwser in ${this.plugin.settings.language}. If you don't speak the language, respond with 'ERROR'`
			},
			{
				"role": "user", 
				"content": input
			}
		],
			"temperature": temperature,
			"model": this.ai_model
		}

		try {
			let response = await requestUrl({
				url: "https://api.groq.com/openai/v1/chat/completions",
				method: "POST",
				headers: this.headers,
				body: JSON.stringify(data)
			})

			if (response.status !== 200) {
				throw `Error in asking Groq (${response.status})`
			}

			console.log(response.text)

			let response_message = JSON.parse(response.text).choices[0].message.content
			response_message = JSON.parse(response.text)
			response_message = response_message.choices[0].message.content

			if (response_message === "ERROR") {
				throw "No answer was found"
			}
			return response_message


		} catch (e) {
			if (typeof e === "string") {
				new Notice(e)
				
			} else {
				console.log(e.message)
				new Notice("Error in asking the AI model")
			}
			return ""

		}
	}

	async show(input: string) {
		const modal = new Modal(this.plugin.app);
		const answer = await this.ask(input, 0.0)
		modal.onOpen = () => {
			modal.contentEl.createEl("h3", {text: "Definition"})
			modal.contentEl.createEl("p", {text: answer})
			new Setting(modal.contentEl)
				.addButton((btn) =>
					btn
					.setButtonText("Ok")
					.onClick(() => {
						modal.close();
					}))
		}
		modal.open()
		
	}
}