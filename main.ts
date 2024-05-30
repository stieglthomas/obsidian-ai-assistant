import { Editor, Notice, Plugin } from 'obsidian';

import { MainSettingTab, KeylessSettingTab, updateAvalibaleModels, openSettings, setStatusBar} from './settings';
import { Groq } from './groq';


interface MyPluginSettings {
	groq_key: string;
	llm_model: string;
	instruct_summary: string;
	instruct_keypoint: string;
	temperature: number;
}

let DEFAULT_SETTINGS: MyPluginSettings = {
	groq_key: "",
	llm_model: "",
	instruct_summary: "Summarize the following text. Answer strictly in the input language",
	instruct_keypoint: "Identify the key points in the following text. Answer strictly in the input language",
	temperature: 0.8
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

		setStatusBar(this);


		const summarizer = new Groq(this, this.settings.instruct_summary)

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
		setStatusBar(this);
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








