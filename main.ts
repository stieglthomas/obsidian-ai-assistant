import { Editor, Notice, Plugin } from 'obsidian';

import { MainSettingTab, KeylessSettingTab, updateAvalibaleModels, openSettings, setStatusBar} from './settings';
import { Groq } from './groq';


interface MyPluginSettings {
	groq_key: string;
	llm_model: string;
	instruct_general: string;
	instruct_summary: string;
	instruct_keypoint: string;
	instruct_define: string;
	temperature: number;
}

let DEFAULT_SETTINGS: MyPluginSettings = {
	groq_key: "",
	llm_model: "",
	instruct_general: "Answer the following question in the input language; Important: If you have no answer, only respond with 'ERROR'",
	instruct_summary: "Summarize the following text",
	instruct_keypoint: "Identify the key points in the following text",
	instruct_define: "Define the following text",
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


		const Definer = new Groq(this, this.settings.instruct_define)
		this.addCommand({
			id: "define-text",
			name: "Define Text",
			editorCallback: async (editor: Editor) => {
				let answer = await Definer.ask(editor.getSelection())
				new Notice(answer)
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








