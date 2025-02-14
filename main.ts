import { 
    App, 
    Editor,
    MarkdownView,
    Notice,
    Plugin,
    TFile,
    EventRef
} from 'obsidian'

const dedent = (strings: TemplateStringsArray, ...values: any[]): string => {
    const fullString = strings.reduce(
      (acc, str, i) => acc + (i > 0 ? values[i - 1] : '') + str,
      ''
    )
  
    const lines = fullString.split('\n')
    if (lines[0].trim() === '') lines.shift()
    if (lines[lines.length - 1].trim() === '') lines.pop()
  
    const indentLengths = lines
      .filter(line => line.trim())
      .map(line => {
        const match = line.match(/^(\s*)/)
        return match ? match[1].length : 0
      })
    const minIndent = Math.min(...indentLengths)
  
    return lines.map(line => line.slice(minIndent)).join('\n')
}

export default class InternalLinkCreator extends Plugin {
    private fileChangeRef: EventRef

    async onload() {
        this.fileChangeRef = this.app.vault.on('modify', async (file: TFile) => {
            await this.handleFileChange(file)
        })

        this.addCommand({
            id: 'make-it-as-internal',
            name: 'Make selection as internal link',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                const selectedText = editor.getSelection()
                if (!selectedText) {
                    new Notice('텍스트를 선택해주세요')
                    return
                }

                
                try {
                    const currentFile = view.file
                    if (!currentFile) {
                        new Notice('현재 파일을 찾을 수 없습니다')
                        return
                    }
                    
                    const displayName = selectedText
                    const fileName = `${currentFile.basename}__${selectedText}`
                    
                    const breadcrumb = this.getBreadcrumb(fileName)
                    
                    const newNoteContent = dedent`
                    ---
                    aliases: ["${displayName}"]
                    ---

                    ${breadcrumb}

                    # ${selectedText}
                    
                    `

                    // 파일 경로 처리
                    const normalizedFileName = this.normalizeFileName(fileName)
                    const filePath = `${normalizedFileName}.md`
                    
                    await this.app.vault.create(filePath, newNoteContent)
                    editor.replaceSelection(`[[${fileName}|${displayName}]]`)
                    
                    new Notice('내부 링크가 생성되었습니다')
                } catch (error) {
                    new Notice('링크 생성 중 오류가 발생했습니다')
                    console.error(error)
                }
            }
        })
    }

    private normalizeFileName(fileName: string): string {
        // 파일 이름에서 허용되지 않는 문자 처리
        return fileName.replace(/[\\/:*?"<>|]/g, '-')
                     .trim()
                     .replace(/\s+/g, ' ') // 연속된 공백을 하나로
    }

    private getDisplayName(fileName: string): string {
        const parts = fileName.split('__')
        return parts[parts.length - 1] || fileName
    }

    private getBreadcrumb(fileName: string): string {
        const parts = fileName.split('__')
        const breadcrumbs = []
        let currentPath = ''
        
        for (let i = 0; i < parts.length; i++) {
            if (i === 0) {
                currentPath = parts[0]
            } else {
                currentPath = `${currentPath}__${parts[i]}`
            }
            const displayName = parts[i]
            breadcrumbs.push(`[[${currentPath}|${displayName}]]`)
        }
        
        return breadcrumbs.join(' > ')
    }

    private async handleFileChange(file: TFile) {
        const content = await this.app.vault.read(file)
        const parts = content.split('---')
        if (parts.length < 3) return
        
        const mainContent = parts.slice(2).join('---')
        const headingMatch = mainContent.match(/^\s*# (.+)$/m)
        
        if (headingMatch) {
            const newTitle = headingMatch[1]
            const oldTitle = this.getOldTitle(file)
            
            if (oldTitle && oldTitle !== newTitle) {
                const fileNameParts = file.basename.split('__')
                const prefix = fileNameParts.slice(0, -1).join('__')
                const newFileName = prefix ? `${prefix}__${newTitle}` : newTitle
                
                // Update file name
                const normalizedNewFileName = this.normalizeFileName(newFileName)
                const newPath = `${normalizedNewFileName}.md`
                await this.app.fileManager.renameFile(file, newPath)
                
                // Update aliases in frontmatter
                let updatedContent = content.replace(
                    /aliases: \[".+?"\]/,
                    `aliases: ["${newTitle}"]`
                )
                
                // Update breadcrumb
                const newBreadcrumb = this.getBreadcrumb(newFileName)
                updatedContent = updatedContent.replace(
                    /^.*>.*$/m,  // Matches the breadcrumb line
                    newBreadcrumb
                )
                
                await this.app.vault.modify(file, updatedContent)
                
                // Update links in other files
                await this.updateLinksInFiles(file.basename, newFileName, newTitle)
            }
        }
    }

    private getOldTitle(file: TFile): string | null {
        const cache = this.app.metadataCache.getFileCache(file)
        if (cache?.headings && cache.headings.length > 0) {
            return cache.headings[0].heading
        }
        return null
    }

    private async updateLinksInFiles(oldFileName: string, newFileName: string, newDisplayName: string) {
        const files = this.app.vault.getMarkdownFiles()
        
        for (const file of files) {
            const content = await this.app.vault.read(file)
            const linkRegex = new RegExp(`\\[\\[${oldFileName}\\|.+?\\]\\]`, 'g')
            const updatedContent = content.replace(
                linkRegex,
                `[[${newFileName}|${newDisplayName}]]`
            )
            
            if (content !== updatedContent) {
                await this.app.vault.modify(file, updatedContent)
            }
        }
    }

    onunload() {
        this.app.vault.offref(this.fileChangeRef)
    }
}