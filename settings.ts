import { App, PluginSettingTab, Setting, Notice, Modal, requestUrl } from 'obsidian';

import MyPlugin from './main';
import { type } from 'os';

const manifest = require('./manifest.json');

let ai_models : Record<string, string> = {};



export function openSettings(plugin: MyPlugin) {
	const setting = (plugin.app as any).setting;
	setting.open();
	setting.openTabById(manifest.id);
}


// Settings Tabs

export class MainSettingTab extends PluginSettingTab {
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



export class KeylessSettingTab extends PluginSettingTab {
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



// Settings Modal

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



// Status Bar
let statusBarItem: HTMLElement;
export function setStatusBar(plugin: MyPlugin) {
	if (!statusBarItem){
		statusBarItem = plugin.addStatusBarItem();
	}
	statusBarItem.setText(`${plugin.settings.llm_model} (${plugin.settings.temperature})`);
	statusBarItem.addEventListener("click", evt => {
		openSettings(this);
	});

}




// Additional Functions

export async function updateAvalibaleModels(plugin: MyPlugin, groq_key?: string) {

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