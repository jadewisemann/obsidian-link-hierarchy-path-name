import { App, Plugin, PluginSettingTab, Setting, ButtonComponent } from 'obsidian'

interface QuickAccessSettings {
    files: string[]
    maxFiles: number
}

const DEFAULT_SETTINGS: QuickAccessSettings = {
    files: ['', '', '', '', ''],
    maxFiles: 5
}

export default class QuickAccessPlugin extends Plugin {
    settings: QuickAccessSettings
    commands: { [id: string]: any } = {}

    async onload() {
        await this.loadSettings()
        
        this.registerCommands()
        
        this.addSettingTab(new QuickAccessSettingTab(this.app, this))
    }
    
    registerCommands() {
        Object.keys(this.commands).forEach(id => {
            this.app.commands.removeCommand(this.commands[id].id)
        })
        
        this.commands = {}
        
        for (let i = 0; i < this.settings.files.length; i++) {
            const fileIndex = i + 1
            const commandId = `open-quick-access-${fileIndex}`
            
            const command = this.addCommand({
                id: commandId,
                name: `빠른 접근 ${fileIndex}번 파일 열기`,
                callback: () => {
                    if (this.settings.files[i]) {
                        const file = this.app.vault.getAbstractFileByPath(this.settings.files[i])
                        if (file) this.app.workspace.getLeaf().openFile(file)
                    }
                }
            })
            
            this.commands[commandId] = command
        }
    }

    async loadSettings() {
        const loadedData = await this.loadData()
        
        if (loadedData && (loadedData.file1 !== undefined || loadedData.file2 !== undefined)) {
            const oldSettings = loadedData as any
            const newSettings: QuickAccessSettings = {
                files: [
                    oldSettings.file1 || '',
                    oldSettings.file2 || '',
                    oldSettings.file3 || '',
                    oldSettings.file4 || '',
                    oldSettings.file5 || ''
                ],
                maxFiles: 5
            }
            this.settings = newSettings
        } else {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData)
        }
    }

    async saveSettings() {
        await this.saveData(this.settings)
    }
}

class QuickAccessSettingTab extends PluginSettingTab {
    plugin: QuickAccessPlugin

    constructor(app: App, plugin: QuickAccessPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    display(): void {
        const {containerEl} = this
        containerEl.empty()

        containerEl.createEl('h2', {text: '빠른 접근 설정'})
        
        containerEl.createEl('p', {
            text: '각 파일에 대한 숏컷을 설정하려면 Obsidian의 단축키 설정에서 "빠른 접근 [번호]번 파일 열기" 명령을 찾아 단축키를 할당하세요.'
        })

        // 파일 설정들을 표시
        this.plugin.settings.files.forEach((filePath, index) => {
            const fileIndex = index + 1
            new Setting(containerEl)
                .setName(`빠른 접근 ${fileIndex}번 파일`)
                .setDesc('파일 경로를 입력하세요 (예: folder/file.md)')
                .addText(text => text
                    .setPlaceholder('파일 경로 입력')
                    .setValue(filePath)
                    .onChange(async (value) => {
                        this.plugin.settings.files[index] = value
                        await this.plugin.saveSettings()
                    })
                )
                .addExtraButton(button => {
                    button
                        .setIcon('trash')
                        .setTooltip('이 항목 삭제')
                        .onClick(async () => {
                            this.plugin.settings.files.splice(index, 1)
                            await this.plugin.saveSettings()
                            this.plugin.registerCommands()
                            this.display()
                        })
                })
        })

        new Setting(containerEl)
            .setName('새 파일 추가')
            .setDesc('새로운 빠른 접근 파일을 추가합니다.')
            .addButton(button => button
                .setButtonText('파일 추가')
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.files.push('')
                    await this.plugin.saveSettings()
                    this.plugin.registerCommands()
                    this.display()
                })
            )

        new Setting(containerEl)
            .setName('최대 파일 개수')
            .setDesc('파일 개수 제한 설정 (1-20)')
            .addSlider(slider => slider
                .setLimits(1, 20, 1)
                .setValue(this.plugin.settings.maxFiles)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxFiles = value
                    
                    if (this.plugin.settings.files.length > value) {
                        this.plugin.settings.files = this.plugin.settings.files.slice(0, value)
                        this.plugin.registerCommands()
                        this.display()
                    }
                    
                    await this.plugin.saveSettings()
                })
            )
            
        new Setting(containerEl)
            .setName('모든 파일 초기화')
            .setDesc('모든 빠른 접근 파일을 초기화합니다.')
            .addButton(button => button
                .setButtonText('초기화')
                .onClick(async () => {
                    if (confirm('모든 빠른 접근 파일을 초기화하시겠습니까?')) {
                        this.plugin.settings.files = ['']
                        await this.plugin.saveSettings()
                        this.plugin.registerCommands()
                        this.display()
                    }
                })
            )
    }
}