const { Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf } = require('obsidian');

// Konstante für den View-Typ
const VIEW_TYPE_CLOCK = "obsidian-clock-all-in-one";

class ClockView extends ItemView {
    constructor(leaf, settings) {
        super(leaf);
        this.settings = settings;
        this.stopwatchInterval = null;
        this.stopwatchTime = 0;
        this.timerInterval = null;
        this.pomodoroInterval = null;
        this.isWorkSession = true;
        this.alarmInterval = null;
    }

    getViewType() {
        return VIEW_TYPE_CLOCK;
    }

    getDisplayText() {
        return "Clock Suite";
    }

    async onOpen() {
        this.render();
    }

    async onClose() {
        if (this.stopwatchInterval) clearInterval(this.stopwatchInterval);
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.pomodoroInterval) clearInterval(this.pomodoroInterval);
        if (this.alarmInterval) clearInterval(this.alarmInterval);
    }

    render() {
        const container = this.contentEl;
        container.empty();
        container.addClass('clock-plugin-container');

        const style = document.createElement('style');
        style.textContent = `
            .clock-plugin-container { padding: 15px; display: flex; flex-direction: column; gap: 20px; }
            .clock-section { border: 1px solid var(--background-modifier-border); padding: 15px; border-radius: 8px; background: var(--background-primary-alt); }
            .clock-section h3 { margin-top: 0; font-size: 0.8em; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px; }
            .display-big { font-size: 2.2em; font-family: var(--font-monospace); text-align: center; margin: 15px 0; color: var(--text-accent); }
            .button-group { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
            .world-clock-item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9em; border-bottom: 1px solid var(--background-modifier-border-focus); padding-bottom: 4px; }
            .alarm-item { display: flex; justify-content: space-between; align-items: center; background: var(--background-secondary); padding: 6px 12px; border-radius: 4px; margin-top: 8px; }
            input[type="time"], input[type="number"], .tz-search-input { width: 100%; margin-bottom: 10px; background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); color: var(--text-normal); border-radius: 4px; padding: 4px; }
            .pomodoro-status { font-weight: bold; color: var(--text-success); margin-bottom: 5px; }
            .timezone-tag { display: inline-flex; align-items: center; background: var(--background-secondary-alt); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 2px 8px; margin: 2px; font-size: 0.85em; }
            .timezone-tag-remove { margin-left: 8px; cursor: pointer; color: var(--text-error); font-weight: bold; }
        `;
        container.appendChild(style);

        this.renderWorldClock(container);
        this.renderStopwatch(container);
        this.renderTimer(container);
        this.renderPomodoro(container);
        this.renderAlarms(container);
    }

    renderWorldClock(parent) {
        const section = parent.createDiv({ cls: 'clock-section' });
        section.createEl('h3', { text: 'Weltuhr' });
        const list = section.createDiv();

        const update = () => {
            list.empty();
            if (this.settings.worldCities.length === 0) {
                list.createEl('i', { text: 'Keine Zeitzonen in den Einstellungen gewählt.' });
                return;
            }
            this.settings.worldCities.forEach(tz => {
                try {
                    const time = new Date().toLocaleTimeString('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const item = list.createDiv({ cls: 'world-clock-item' });
                    item.createSpan({ text: tz.split('/').pop().replace(/_/g, ' ') });
                    item.createSpan({ text: time, cls: 'font-monospace' });
                } catch (e) {
                    console.error("Invalid timezone:", tz);
                }
            });
        };
        update();
        setInterval(update, 1000);
    }

    renderStopwatch(parent) {
        const section = parent.createDiv({ cls: 'clock-section' });
        section.createEl('h3', { text: 'Stoppuhr' });
        const display = section.createDiv({ cls: 'display-big', text: '00:00:00.0' });
        const btns = section.createDiv({ cls: 'button-group' });
        
        const startBtn = btns.createEl('button', { text: 'Start' });
        const resetBtn = btns.createEl('button', { text: 'Reset' });

        startBtn.onclick = () => {
            if (this.stopwatchInterval) {
                clearInterval(this.stopwatchInterval);
                this.stopwatchInterval = null;
                startBtn.innerText = 'Start';
            } else {
                const start = Date.now() - this.stopwatchTime;
                this.stopwatchInterval = setInterval(() => {
                    this.stopwatchTime = Date.now() - start;
                    const d = new Date(this.stopwatchTime);
                    display.innerText = d.toISOString().substr(11, 10);
                }, 100);
                startBtn.innerText = 'Stop';
            }
        };

        resetBtn.onclick = () => {
            clearInterval(this.stopwatchInterval);
            this.stopwatchInterval = null;
            this.stopwatchTime = 0;
            display.innerText = '00:00:00.0';
            startBtn.innerText = 'Start';
        };
    }

    renderTimer(parent) {
        const section = parent.createDiv({ cls: 'clock-section' });
        section.createEl('h3', { text: 'Timer' });
        const input = section.createEl('input', { type: 'number', attr: { placeholder: 'Minuten' } });
        const display = section.createDiv({ cls: 'display-big', text: '00:00' });
        const btns = section.createDiv({ cls: 'button-group' });
        const startBtn = btns.createEl('button', { text: 'Start' });

        startBtn.onclick = () => {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                startBtn.innerText = 'Start';
                return;
            }
            let sec = (parseInt(input.value) || 0) * 60;
            if (sec <= 0) return;
            startBtn.innerText = 'Stop';
            this.timerInterval = setInterval(() => {
                sec--;
                const m = Math.floor(sec / 60);
                const s = sec % 60;
                display.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                if (sec <= 0) {
                    clearInterval(this.timerInterval);
                    this.timerInterval = null;
                    startBtn.innerText = 'Start';
                    new Notification("Timer abgelaufen!");
                }
            }, 1000);
        };
    }

    renderPomodoro(parent) {
        const section = parent.createDiv({ cls: 'clock-section' });
        section.createEl('h3', { text: 'Pomodoro' });
        const status = section.createDiv({ text: 'Bereit', cls: 'pomodoro-status' });
        status.style.textAlign = 'center';
        
        const display = section.createDiv({ cls: 'display-big', text: `${String(this.settings.pomodoroWork).padStart(2, '0')}:00` });
        const btns = section.createDiv({ cls: 'button-group' });
        const startBtn = btns.createEl('button', { text: 'Start' });
        const resetBtn = btns.createEl('button', { text: 'Reset' });

        let timeLeft = this.settings.pomodoroWork * 60;

        const updateDisplay = () => {
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            display.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        };

        startBtn.onclick = () => {
            if (this.pomodoroInterval) {
                clearInterval(this.pomodoroInterval);
                this.pomodoroInterval = null;
                startBtn.innerText = 'Start';
                return;
            }
            startBtn.innerText = 'Stop';
            status.innerText = this.isWorkSession ? 'Arbeitsphase' : 'Pause';
            this.pomodoroInterval = setInterval(() => {
                timeLeft--;
                updateDisplay();
                if (timeLeft <= 0) {
                    this.isWorkSession = !this.isWorkSession;
                    timeLeft = (this.isWorkSession ? this.settings.pomodoroWork : this.settings.pomodoroBreak) * 60;
                    status.innerText = this.isWorkSession ? 'Arbeitsphase' : 'Pause';
                    new Notification(this.isWorkSession ? "Arbeit beginnt!" : "Zeit für eine Pause!");
                }
            }, 1000);
        };

        resetBtn.onclick = () => {
            clearInterval(this.pomodoroInterval);
            this.pomodoroInterval = null;
            this.isWorkSession = true;
            timeLeft = this.settings.pomodoroWork * 60;
            updateDisplay();
            status.innerText = 'Bereit';
            startBtn.innerText = 'Start';
        };
    }

    renderAlarms(parent) {
        const section = parent.createDiv({ cls: 'clock-section' });
        section.createEl('h3', { text: 'Wecker' });
        const timeInput = section.createEl('input', { type: 'time' });
        const addBtn = section.createEl('button', { text: 'Wecker stellen', cls: 'mod-cta' });
        addBtn.style.width = '100%';
        const list = section.createDiv();

        const alarms = [];
        const updateList = () => {
            list.empty();
            alarms.forEach((a, i) => {
                const item = list.createDiv({ cls: 'alarm-item' });
                item.createSpan({ text: a });
                const del = item.createEl('button', { text: 'Löschen' });
                del.onclick = () => { alarms.splice(i, 1); updateList(); };
            });
        };

        addBtn.onclick = () => {
            if (timeInput.value && !alarms.includes(timeInput.value)) {
                alarms.push(timeInput.value);
                updateList();
            }
        };

        this.alarmInterval = setInterval(() => {
            const now = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const idx = alarms.indexOf(now);
            if (idx > -1) {
                new Notification("Wecker: " + now);
                alarms.splice(idx, 1);
                updateList();
            }
        }, 10000);
    }
}

class ClockSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        // Dynamisch alle unterstützten Zeitzonen laden
        this.allTimezones = Intl.supportedValuesOf('timeZone');
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'All-in-One Clock Einstellungen' });

        // Weltuhr Einstellungen
        containerEl.createEl('h3', { text: 'Weltuhr' });
        
        new Setting(containerEl)
            .setName('Zeitzone suchen & hinzufügen')
            .setDesc('Tippe zum Filtern der Liste.')
            .addSearch(search => {
                search.setPlaceholder("z.B. Berlin, Tokyo, New York...")
                    .onChange(async (query) => {
                        // Dynamisches Dropdown-Update basierend auf Suche
                        const filtered = this.allTimezones.filter(tz => 
                            tz.toLowerCase().includes(query.toLowerCase())
                        ).slice(0, 50); // Limit auf 50 Ergebnisse für Performance

                        const selectEl = dropdownSetting.controlEl.querySelector('select');
                        selectEl.empty();
                        selectEl.createEl('option', { text: 'Wähle eine Zeitzone...', value: '' });
                        filtered.forEach(tz => {
                            selectEl.createEl('option', { text: tz, value: tz });
                        });
                    });
            });

        const dropdownSetting = new Setting(containerEl)
            .setName('Ergebnis auswählen')
            .addDropdown(dropdown => {
                dropdown.addOption('', 'Wähle eine Zeitzone...');
                // Initiale Füllung (erste 50)
                this.allTimezones.slice(0, 50).forEach(tz => dropdown.addOption(tz, tz));
                
                dropdown.onChange(async (value) => {
                    if (value && !this.plugin.settings.worldCities.includes(value)) {
                        this.plugin.settings.worldCities.push(value);
                        await this.plugin.saveSettings();
                        this.display();
                    }
                });
            });

        new Setting(containerEl)
            .setName('Aktive Zeitzonen')
            .setDesc('Klicke auf das X, um eine Zone zu entfernen.')
            .then(setting => {
                setting.controlEl.empty();
                const list = setting.controlEl.createDiv({ style: 'display: flex; flex-wrap: wrap; gap: 5px;' });
                this.plugin.settings.worldCities.forEach((tz, index) => {
                    const tag = list.createDiv({ cls: 'timezone-tag' });
                    tag.createSpan({ text: tz });
                    const removeBtn = tag.createSpan({ text: '✕', cls: 'timezone-tag-remove' });
                    removeBtn.onclick = async () => {
                        this.plugin.settings.worldCities.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    };
                });
            });

        // Pomodoro Einstellungen
        containerEl.createEl('h3', { text: 'Pomodoro Timer' });
        new Setting(containerEl)
            .setName('Arbeitsphase (Minuten)')
            .addSlider(slider => slider
                .setLimits(1, 120, 1)
                .setValue(this.plugin.settings.pomodoroWork)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.pomodoroWork = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Pausenphase (Minuten)')
            .addSlider(slider => slider
                .setLimits(1, 60, 1)
                .setValue(this.plugin.settings.pomodoroBreak)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.pomodoroBreak = value;
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = class ClockPlugin extends Plugin {
    async onload() {
        this.settings = Object.assign({
            worldCities: ['Europe/Berlin', 'UTC'],
            pomodoroWork: 25,
            pomodoroBreak: 5
        }, await this.loadData());

        this.registerView(VIEW_TYPE_CLOCK, (leaf) => new ClockView(leaf, this.settings));

        this.addRibbonIcon('clock', 'Clock Suite', () => {
            this.activateView();
        });

        this.addSettingTab(new ClockSettingTab(this.app, this));
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_CLOCK)[0];
        if (!leaf) {
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({ type: VIEW_TYPE_CLOCK, active: true });
                leaf = rightLeaf;
            }
        }
        if (leaf) workspace.revealLeaf(leaf);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
};
