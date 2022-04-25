const { GObject, GLib, Gio, St, Soup } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ByteArray = imports.byteArray;

const _domain = Me.metadata['gettext-domain'];
const _ = ExtensionUtils.gettext;

function lg(s) { log("===" + _domain + "===>" + s); }

const Indicator = GObject.registerClass(
	class Indicator extends PanelMenu.Button {
		_init() {
			super._init(0.0, _(Me.metadata['name']));
			this._clipboard = St.Clipboard.get_default();
			this.lasttext = '';

			const micon = new St.Icon({ icon_name : "edit-find-symbolic", style_class : 'system-status-icon' });
			this.add_child(micon);

			this.mqrcode = new PopupMenu.PopupBaseMenuItem();
			this.mqrcode.set_track_hover = true;
			this.icon = new St.Icon({
				icon_name : "edit-find-symbolic",
				icon_size: 256,
			});

			this.mqrcode.actor.add_child(this.icon);
			this.menu.addMenuItem(this.mqrcode);

			this.menu.connect('open-state-changed', (menu, open) => {
				if (open) {
					this._clipboard.get_text(St.ClipboardType.PRIMARY, (clipboard, text) => {
						if (text && text.length > 4 && text !== this.lasttext) {
							const r = GLib.find_program_in_path("qrencode");
							if (!r) {
								Main.notify(_("需要安装qrencode命令。"));
								return;
							}
							this.lasttext = text;
							this.async_cmd(text);
						}
					});
				}
			});
		}

		async_cmd(str) {
			const tmpfile = `/tmp/qrcode_${Date.now()}`;	// Just P 可变文件名解决  St.Icon 不刷新问题。
			try {
				let proc = Gio.Subprocess.new(
					[ 'bash', '-c', `qrencode "${str}" -o ${tmpfile}` ],
					Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

				proc.communicate_async(null, null, (proc, res) => {
					try {
						let [, stdout, stderr] = proc.communicate_finish(res);
						if (proc.get_successful()) {
							this.icon.set_gicon(Gio.icon_new_for_string(tmpfile));
						}
					} catch (e) { logError(e); }
				});
			} catch (e) { logError(e); }
		};


		destroy() {
			super.destroy();
		};
	});

class Extension {
	constructor(uuid) {
		this._uuid = uuid;

		ExtensionUtils.initTranslations();
	}

	enable() {
		this._indicator = new Indicator();
		Main.panel.addToStatusArea(this._uuid, this._indicator);
	}

	disable() {
		this._indicator.destroy();
		this._indicator = null;
	}
}

function init(meta) {
	return new Extension(meta.uuid);
}
