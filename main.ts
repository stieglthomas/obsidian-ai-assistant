import { Editor, Notice, Plugin } from 'obsidian';

import { MainSettingTab, KeylessSettingTab, updateAvalibaleModels, setStatusBar} from './settings';
import { Groq } from './groq';

const languagesDict: { [key: string]: string } = require('./languages.json');

interface MyPluginSettings {
	language: string;
	groq_key: string;
	llm_model: string;
	instruct_general: string;
	instruct_summary: string;
	instruct_keypoint: string;
	instruct_define: string;
	temperature: number;
}

export let DEFAULT_SETTINGS: MyPluginSettings = {
	language: "",
	groq_key: "",
	llm_model: "",
	instruct_general: "Add nothing (no intruduction, no conclusion, no personal opinion, no examples, no additional information). Only provide the requested information",
	instruct_summary: "Summarize the following text",
	instruct_keypoint: "Summarize the following text into readable key points. Only provide the most important information in bullet points",
	instruct_define: "Define the following text",
	temperature: 0.8
}



export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		
		await this.loadSettings();

		const windowLanguage = window.localStorage.getItem('language');
		if (!this.settings.language) {
			if(windowLanguage) {
				this.settings.language =  languagesDict[windowLanguage];
			} else {
				this.settings.language = "English";
			}
		}

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

		this.saveSettings()



		const Summarizer = new Groq(this, this.settings.instruct_summary)
		this.addCommand({
			id: "create-summary",
			name: "Create Summary",
			editorCallback: async (editor: Editor) => {
				await Summarizer.answer(editor)
			}
		})

		const Keypoints = new Groq(this, this.settings.instruct_keypoint)
		this.addCommand({
			id: "create-keypoints",
			name: "Create Key Points",
			editorCallback: async (editor: Editor) => {
				await Keypoints.answer(editor)
			}
		})


		// const Definer = new Groq(this, this.settings.instruct_define)
		// this.addCommand({
		// 	id: "define-text",
		// 	name: "Define Text",
		// 	editorCallback: async (editor: Editor) => {
		// 		let answer = await Definer.ask(editor.getSelection())
		// 		new Notice(answer)
		// 	}
		// })


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
	const cursor = this.getCursor();
	const lineBreak = cursor.ch === 0 ? '' : '\n\n';
	this.replaceSelection(`${lineBreak}> [!${callout}]- ${title}\n> ${text}\n\n`);
};








