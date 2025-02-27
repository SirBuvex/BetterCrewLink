import Store from 'electron-store';
import React, { ReactChild, useContext, useEffect, useReducer, useState } from 'react';
import { SettingsContext, LobbySettingsContext, GameStateContext } from '../contexts';
import MicrophoneSoundBar from './MicrophoneSoundBar';
import TestSpeakersButton from './TestSpeakersButton';
import { ISettings, ILobbySettings } from '../../common/ISettings';
import TextField from '@material-ui/core/TextField';
import makeStyles from '@material-ui/core/styles/makeStyles';
import withStyles from '@material-ui/core/styles/withStyles';
import Box from '@material-ui/core/Box';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Radio from '@material-ui/core/Radio';
import Checkbox from '@material-ui/core/Checkbox';
import RadioGroup from '@material-ui/core/RadioGroup';
import MuiDivider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import { isHttpUri, isHttpsUri } from 'valid-url';
import ChevronLeft from '@material-ui/icons/ArrowBack';
import IconButton from '@material-ui/core/IconButton';
import Alert from '@material-ui/lab/Alert';
import Slider from '@material-ui/core/Slider';
import Tooltip from '@material-ui/core/Tooltip';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import { GameState } from '../../common/AmongUsState';
import Button from '@material-ui/core/Button';
import { ipcRenderer, remote } from 'electron';
import { IpcHandlerMessages } from '../../common/ipc-messages';
import DialogContentText from '@material-ui/core/DialogContentText';
import i18next, { TFunction } from 'i18next';
import languages from '../language/languages';

interface StyleInput {
	open: boolean;
}

const Divider = withStyles((theme) => ({
	root: {
		width: '100%',
		marginTop: theme.spacing(2),
		marginBottom: theme.spacing(2),
	},
}))(MuiDivider);

const useStyles = makeStyles((theme) => ({
	root: {
		width: '100vw',
		height: `calc(100vh - ${theme.spacing(3)}px)`,
		background: '#171717ad',
		backdropFilter: 'blur(4px)',
		position: 'absolute',
		left: 0,
		top: 0,
		zIndex: 99,
		alignItems: 'center',
		marginTop: theme.spacing(3),
		transition: 'transform .1s ease-in-out',
		WebkitAppRegion: 'no-drag',
		transform: ({ open }: StyleInput) => (open ? 'translateX(0)' : 'translateX(-100%)'),
	},
	header: {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		height: 40,
	},
	scroll: {
		paddingTop: theme.spacing(1),
		paddingLeft: theme.spacing(2),
		paddingRight: theme.spacing(2),
		overflowY: 'auto',
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'start',
		alignItems: 'center',
		paddingBottom: theme.spacing(7),
		height: `calc(100vh - 40px - ${theme.spacing(7 + 3 + 3)}px)`,
	},
	shortcutField: {
		marginTop: theme.spacing(1),
	},
	back: {
		cursor: 'pointer',
		position: 'absolute',
		right: theme.spacing(1),
		WebkitAppRegion: 'no-drag',
	},
	alert: {
		position: 'absolute',
		bottom: theme.spacing(1),
		zIndex: 10,
	},
	urlDialog: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'start',
		'&>*': {
			marginBottom: theme.spacing(1),
		},
	},
}));

const keys = new Set([
	'CapsLock',
	'Space',
	'Backspace',
	'Delete',
	'Enter',
	'Up',
	'Down',
	'Left',
	'Right',
	'Home',
	'End',
	'PageUp',
	'PageDown',
	'Escape',
	'LShift',
	'RShift',
	'RAlt',
	'LAlt',
	'RControl',
	'LControl',
]);

export enum pushToTalkOptions {
	VOICE,
	PUSH_TO_TALK,
	PUSH_TO_MUTE,
}

const store = new Store<ISettings>({
	migrations: {
		'2.0.6': (store) => {
			if (
				store.get('serverURL') === 'https://bettercrewl.ink:6523' ||
				store.get('serverURL') === 'http://bettercrewl.ink' ||
				store.get('serverURL') === 'http://crewlink.guus.info' ||
				store.get('serverURL') === 'https://crewlink.guus.info'
			) {
				store.set('serverURL', 'https://bettercrewl.ink');
			}
		},
		'2.0.7': (store) => {
			if (
				store.get('serverURL') === 'https://bettercrewl.ink:6523' ||
				store.get('serverURL') === 'http://bettercrewl.ink' ||
				store.get('serverURL') === 'http://crewlink.guus.info' ||
				store.get('serverURL') === 'https://crewlink.guus.ninja'
			) {
				store.set('serverURL', 'https://bettercrewl.ink');
			}
		},
		'2.1.4': (store) => {
			store.set('playerConfigMap', {});
		},
		'2.2.0': (store) => {
			store.set('mobileHost', true);
		},
		'2.2.5': (store) => {
			const pushToTalkValue = store.get('pushToTalk');
			if (typeof pushToTalkValue === 'boolean') {
				store.set('pushToTalkMode', pushToTalkValue ? pushToTalkOptions.PUSH_TO_TALK : pushToTalkOptions.VOICE);
			}
			// @ts-ignore
			store.delete('pushToTalk');
		},
		'2.3.6': (store) => {
			if ((store.get('serverURL') as String).includes('//crewl.ink')) store.set('serverURL', 'https://bettercrewl.ink');
		},
		'2.4.0': (store) => {
			const currentSensitivity = store.get('micSensitivity') as number;
			if (currentSensitivity >= 0.3) {
				store.set('micSensitivity', 0.15);
				store.set('micSensitivityEnabled', false);
			}
		},
	},
	schema: {
		alwaysOnTop: {
			type: 'boolean',
			default: false,
		},
		language: {
			type: 'string',
			default: 'unkown',
		},
		microphone: {
			type: 'string',
			default: 'Default',
		},
		speaker: {
			type: 'string',
			default: 'Default',
		},
		pushToTalkMode: {
			type: 'number',
			default: pushToTalkOptions.VOICE,
		},
		serverURL: {
			type: 'string',
			default: 'https://bettercrewl.ink',
			format: 'uri',
		},
		pushToTalkShortcut: {
			type: 'string',
			default: 'V',
		},
		deafenShortcut: {
			type: 'string',
			default: 'RControl',
		},
		muteShortcut: {
			type: 'string',
			default: 'RAlt',
		},
		hideCode: {
			type: 'boolean',
			default: false,
		},
		compactOverlay: {
			type: 'boolean',
			default: false,
		},
		overlayPosition: {
			type: 'string',
			default: 'right',
		},
		meetingOverlay: {
			type: 'boolean',
			default: true,
		},
		enableOverlay: {
			type: 'boolean',
			default: true,
		},
		ghostVolume: {
			type: 'number',
			default: 100,
		},
		masterVolume: {
			type: 'number',
			default: 100,
		},
		microphoneGain: {
			type: 'number',
			default: 100,
		},
		microphoneGainEnabled: {
			type: 'boolean',
			default: false,
		},
		micSensitivity: {
			type: 'number',
			default: 0.15,
		},
		micSensitivityEnabled: {
			type: 'boolean',
			default: false,
		},
		natFix: {
			type: 'boolean',
			default: false,
		},
		mobileHost: {
			type: 'boolean',
			default: true,
		},
		vadEnabled: {
			type: 'boolean',
			default: true,
		},
		enableSpatialAudio: {
			type: 'boolean',
			default: true,
		},
		obsSecret: {
			type: 'string',
			default: undefined,
		},
		obsComptaibilityMode: {
			type: 'boolean',
			default: true,
		},
		obsOverlay: {
			type: 'boolean',
			default: false,
		},
		echoCancellation: {
			type: 'boolean',
			default: true,
		},
		noiseSuppression: {
			type: 'boolean',
			default: true,
		},

		playerConfigMap: {
			type: 'object',
			default: {},
		},
		localLobbySettings: {
			type: 'object',
			properties: {
				maxDistance: {
					type: 'number',
					default: 5.32,
				},
				haunting: {
					type: 'boolean',
					default: false,
				},
				commsSabotage: {
					type: 'boolean',
					default: false,
				},
				hearImpostorsInVents: {
					type: 'boolean',
					default: false,
				},
				impostersHearImpostersInvent: {
					type: 'boolean',
					default: false,
				},
				deadOnly: {
					type: 'boolean',
					default: false,
				},
				meetingGhostOnly: {
					type: 'boolean',
					default: false,
				},
				visionHearing: {
					type: 'boolean',
					default: false,
				},
				hearThroughCameras: {
					type: 'boolean',
					default: false,
				},
				wallsBlockAudio: {
					type: 'boolean',
					default: false,
				},
			},
			default: {
				maxDistance: 5.32,
				haunting: false,
				commsSabotage: false,
				hearImpostorsInVents: false,
				hearThroughCameras: false,
				wallsBlockAudio: false,
				deadOnly: false,
				meetingGhostOnly: false,
				visionHearing: false,
			},
		},
	},
});

export interface SettingsProps {
	t: TFunction;
	open: boolean;
	onClose: () => void;
}

export const settingsReducer = (
	state: ISettings,
	action: {
		type: 'set' | 'setOne' | 'setLobbySetting';
		action: [string, unknown] | ISettings;
	}
): ISettings => {
	if (action.type === 'set') {
		return action.action as ISettings;
	}
	const v = action.action as [string, unknown];
	if (action.type === 'setLobbySetting') {
		const lobbySettings = {
			...state.localLobbySettings,
			[v[0]]: v[1],
		};
		v[0] = 'localLobbySettings';
		v[1] = lobbySettings;
	}
	store.set(v[0], v[1]);
	return {
		...state,
		[v[0]]: v[1],
	};
};

export const lobbySettingsReducer = (
	state: ILobbySettings,
	action: {
		type: 'set' | 'setOne';
		action: [string, unknown] | ILobbySettings;
	}
): ILobbySettings => {
	if (action.type === 'set') return action.action as ILobbySettings;
	const v = action.action as [string, unknown];
	return {
		...state,
		[v[0]]: v[1],
	};
};

interface MediaDevice {
	id: string;
	kind: MediaDeviceKind;
	label: string;
}

function validateServerUrl(uri: string): boolean {
	try {
		if (!isHttpUri(uri) && !isHttpsUri(uri)) return false;
		const url = new URL(uri);
		if (url.hostname === 'discord.gg') return false;
		if (url.pathname !== '/') return false;
		return true;
	} catch (_) {
		return false;
	}
}

type URLInputProps = {
	t: (key: string) => string;
	initialURL: string;
	onValidURL: (url: string) => void;
	className: string;
};

const URLInput: React.FC<URLInputProps> = function ({ t, initialURL, onValidURL, className }: URLInputProps) {
	const [isValidURL, setURLValid] = useState(true);
	const [currentURL, setCurrentURL] = useState(initialURL);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		setCurrentURL(initialURL);
	}, [initialURL]);

	function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
		const url = event.target.value.trim();
		setCurrentURL(url);
		if (validateServerUrl(url)) {
			setURLValid(true);
		} else {
			setURLValid(false);
		}
	}

	return (
		<>
			<Button variant="contained" color="secondary" onClick={() => setOpen(true)}>
				{t('settings.advanced.change_server')}
			</Button>
			<Dialog fullScreen open={open} onClose={() => setOpen(false)}>
				<DialogTitle>{t('settings.advanced.change_server')}</DialogTitle>
				<DialogContent className={className}>
					<TextField
						fullWidth
						error={!isValidURL}
						spellCheck={false}
						label={t('settings.advanced.voice_server')}
						value={currentURL}
						onChange={handleChange}
						variant="outlined"
						color="primary"
						helperText={isValidURL ? '' : t('settings.advanced.voice_server')}
					/>
					<Alert severity="error">{t('settings.advanced.voice_server_warning')}</Alert>
					<Button
						color="primary"
						variant="contained"
						onClick={() => {
							setOpen(false);
							setURLValid(true);
							onValidURL('https://bettercrewl.ink');
						}}
					>
						{t('settings.advanced.reset_default')}
					</Button>
				</DialogContent>
				<DialogActions>
					<Button
						color="primary"
						onClick={() => {
							setURLValid(true);
							setOpen(false);
							setCurrentURL(initialURL);
						}}
					>
						{t('buttons.cancel')}
					</Button>
					<Button
						disabled={!isValidURL}
						color="primary"
						onClick={() => {
							setOpen(false);
							let url = currentURL;
							if (url.endsWith('/')) url = url.substring(0, url.length - 1);
							onValidURL(url);
						}}
					>
						{t('buttons.confirm')}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
};

interface DisabledTooltipProps {
	disabled: boolean;
	title: string;
	children: ReactChild;
}

interface IConfirmDialog {
	confirmCallback?: () => void;
	description?: string;
	title?: string;
	open: boolean;
}

const DisabledTooltip: React.FC<DisabledTooltipProps> = function ({ disabled, children, title }: DisabledTooltipProps) {
	if (disabled)
		return (
			<Tooltip placement="top" arrow title={title}>
				<span>{children}</span>
			</Tooltip>
		);
	else return <>{children}</>;
};

const Settings: React.FC<SettingsProps> = function ({ t, open, onClose }: SettingsProps) {
	const classes = useStyles({ open });
	const [settings, setSettings] = useContext(SettingsContext);
	const gameState = useContext(GameStateContext);
	const [lobbySettings, setLobbySettings] = useContext(LobbySettingsContext);
	const [unsavedCount, setUnsavedCount] = useState(0);
	const unsaved = unsavedCount > 2;
	useEffect(() => {
		setSettings({
			type: 'set',
			action: store.store,
		});
		setLobbySettings({
			type: 'set',
			action: store.get('localLobbySettings'),
		});
	}, []);

	useEffect(() => {
		setUnsavedCount((s) => s + 1);
	}, [
		settings.microphone,
		settings.speaker,
		settings.serverURL,
		settings.vadEnabled,
		settings.natFix,
		settings.noiseSuppression,
		settings.echoCancellation,
		settings.obsComptaibilityMode,
		settings.mobileHost,
		settings.microphoneGainEnabled,
		settings.micSensitivityEnabled,
	]);

	useEffect(() => {
		remote.getCurrentWindow().setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
	}, [settings.alwaysOnTop]);

	useEffect(() => {
		ipcRenderer.send('enableOverlay', settings.enableOverlay);
	}, [settings.enableOverlay]);

	const [devices, setDevices] = useState<MediaDevice[]>([]);
	const [_, updateDevices] = useReducer((state) => state + 1, 0);
	useEffect(() => {
		navigator.mediaDevices.enumerateDevices().then((devices) =>
			setDevices(
				devices.map((d) => {
					let label = d.label;
					if (d.deviceId === 'default') {
						label = t('buttons.default');
					} else {
						const match = /(.+?)\)/.exec(d.label);
						if (match && match[1]) label = match[1] + ')';
					}
					return {
						id: d.deviceId,
						kind: d.kind,
						label,
					};
				})
			)
		);
	}, [_]);

	const setShortcut = (ev: React.KeyboardEvent, shortcut: string) => {
		//	console.log(ev, shortcut);
		let k = ev.key;
		if (k.length === 1) k = k.toUpperCase();
		else if (k.startsWith('Arrow')) k = k.substring(5);
		if (k === ' ') k = 'Space';

		/* @ts-ignore */
		const c = ev.code as string;
		if (c && c.startsWith('Numpad')) {
			k = c;
		}

		if (k === 'Control' || k === 'Alt' || k === 'Shift') k = (ev.location === 1 ? 'L' : 'R') + k;

		if (/^[0-9A-Z]$/.test(k) || /^F[0-9]{1,2}$/.test(k) || keys.has(k) || k.startsWith('Numpad')) {
			if (k === 'Escape') {
				console.log('disable??');
				k = 'Disabled';
			}
			setSettings({
				type: 'setOne',
				action: [shortcut, k],
			});

			ipcRenderer.send(IpcHandlerMessages.RESET_KEYHOOKS);
		}
	};

	const setMouseShortcut = (ev: React.MouseEvent<HTMLDivElement>, shortcut: string) => {
		if (ev.button > 2) {
			// this makes our button start at 1 instead of 0
			// React Mouse event starts at 0, but IOHooks starts at 1
			const k = `MouseButton${ev.button + 1}`;
			setSettings({
				type: 'setOne',
				action: [shortcut, k],
			});
			ipcRenderer.send(IpcHandlerMessages.RESET_KEYHOOKS);
		}
	};

	const resetDefaults = () => {
		store.clear();
		setSettings({
			type: 'set',
			action: store.store,
		});

		// I'm like 90% sure this isn't necessary but whenever you click the mic/speaker dropdown it is called, so it may be necessary
		// updateDevices();

		// This is necessary for resetting hotkeys properly, the main thread needs to be notified to reset the hooks
		ipcRenderer.send(IpcHandlerMessages.RESET_KEYHOOKS);
		location.reload();
	};

	const microphones = devices.filter((d) => d.kind === 'audioinput');
	const speakers = devices.filter((d) => d.kind === 'audiooutput');
	const [localLobbySettings, setLocalLobbySettings] = useState(settings.localLobbySettings);

	useEffect(() => {
		setLocalLobbySettings(settings.localLobbySettings);
	}, [settings.localLobbySettings]);

	useEffect(() => {
		console.log(settings.language);
		if (settings.language === 'unkown') {
			const locale: string = remote.app.getLocale();
			const lang = Object.keys(languages).includes(locale)
				? locale
				: Object.keys(languages).includes(locale.split('-')[0])
				? locale.split('-')[0]
				: undefined;
			if (lang) {
				settings.language = lang;
				setSettings({
					type: 'setOne',
					action: ['language', settings.language],
				});
			}
		}
		i18next.changeLanguage(settings.language);
	}, [settings.language]);

	const isInMenuOrLobby = gameState?.gameState === GameState.LOBBY || gameState?.gameState === GameState.MENU;
	const canChangeLobbySettings =
		gameState?.gameState === GameState.MENU || (gameState?.isHost && gameState?.gameState === GameState.LOBBY);
	const canResetSettings =
		gameState?.gameState === undefined ||
		!gameState?.isHost ||
		gameState.gameState === GameState.MENU ||
		gameState.gameState === GameState.LOBBY;

	const [warningDialog, setWarningDialog] = React.useState({ open: false } as IConfirmDialog);

	const handleWarningDialogClose = (confirm: boolean) => {
		if (confirm && warningDialog.confirmCallback) {
			warningDialog.confirmCallback();
		}
		setWarningDialog({ open: false });
	};

	const openWarningDialog = (
		dialogTitle: string,
		dialogDescription: string,
		confirmCallback?: () => any,
		showDialog?: boolean
	) => {
		if (!showDialog) {
			if (confirmCallback) confirmCallback();
		} else {
			setWarningDialog({ title: dialogTitle, description: dialogDescription, open: true, confirmCallback });
		}
	};
	return (
		<Box className={classes.root}>
			<div className={classes.header}>
				<IconButton
					className={classes.back}
					size="small"
					onClick={() => {
						// setSettings({
						// 	type: 'setOne',
						// 	action: ['localLobbySettings', lobbySettings],
						// });
						if (unsaved) {
							onClose();
							location.reload();
						} else onClose();
					}}
				>
					<ChevronLeft htmlColor="#777" />
				</IconButton>
				<Typography variant="h6">{t('settings.title')}</Typography>
			</div>
			<div className={classes.scroll}>
				{/* Lobby Settings */}
				<div>
					<Dialog
						open={warningDialog.open}
						onClose={handleWarningDialogClose}
						aria-labelledby="alert-dialog-title"
						aria-describedby="alert-dialog-description"
					>
						<DialogTitle id="alert-dialog-title">{warningDialog.title}</DialogTitle>
						<DialogContent>
							<DialogContentText id="alert-dialog-description">{warningDialog.description}</DialogContentText>
						</DialogContent>
						<DialogActions>
							<Button onClick={() => handleWarningDialogClose(true)} color="primary">
								{t('buttons.confirm')}
							</Button>
							<Button onClick={() => handleWarningDialogClose(false)} color="primary" autoFocus>
								{t('buttons.cancel')}
							</Button>
						</DialogActions>
					</Dialog>
				</div>

				<Typography variant="h6">{t('settings.lobbysettings.title')}</Typography>
				<div>
					<Typography id="input-slider" gutterBottom>
						{(canChangeLobbySettings ? localLobbySettings.visionHearing : lobbySettings.visionHearing)
							? t('settings.lobbysettings.voicedistance_impostor')
							: t('settings.lobbysettings.voicedistance')}{' '}
						: {canChangeLobbySettings ? localLobbySettings.maxDistance : lobbySettings.maxDistance}
					</Typography>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<Slider
							disabled={!canChangeLobbySettings}
							value={canChangeLobbySettings ? localLobbySettings.maxDistance : lobbySettings.maxDistance}
							min={1}
							max={10}
							step={0.1}
							onChange={(_, newValue: number | number[]) => {
								localLobbySettings.maxDistance = newValue as number;
								setLocalLobbySettings(localLobbySettings);
							}}
							onChangeCommitted={(_, newValue: number | number[]) => {
								setSettings({
									type: 'setLobbySetting',
									action: ['maxDistance', newValue as number],
								});
							}}
						/>
					</DisabledTooltip>
				</div>
				<div>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							label={t('settings.lobbysettings.wallsblockaudio')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								localLobbySettings.wallsBlockAudio = newValue;
								setLocalLobbySettings(localLobbySettings);

								setSettings({
									type: 'setLobbySetting',
									action: ['wallsBlockAudio', newValue],
								});
							}}
							value={canChangeLobbySettings ? localLobbySettings.wallsBlockAudio : lobbySettings.wallsBlockAudio}
							checked={canChangeLobbySettings ? localLobbySettings.wallsBlockAudio : lobbySettings.wallsBlockAudio}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							label={t('settings.lobbysettings.visiononly')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								// openWarningDialog(
								// 	'Be aware!',
								// 	'Imposters and original crewlink users still use the voice distance setting',
								// 	() => {
								localLobbySettings.visionHearing = newValue;
								setSettings({
									type: 'setLobbySetting',
									action: ['visionHearing', newValue],
								});

								setLocalLobbySettings(localLobbySettings);
								// 	},
								// 	newValue
								// );
							}}
							value={canChangeLobbySettings ? localLobbySettings.visionHearing : lobbySettings.visionHearing}
							checked={canChangeLobbySettings ? localLobbySettings.visionHearing : lobbySettings.visionHearing}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							label={t('settings.lobbysettings.impostorshearsghost')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								localLobbySettings.haunting = newValue;
								setLocalLobbySettings(localLobbySettings);

								setSettings({
									type: 'setLobbySetting',
									action: ['haunting', newValue],
								});
							}}
							value={canChangeLobbySettings ? localLobbySettings.haunting : lobbySettings.haunting}
							checked={canChangeLobbySettings ? localLobbySettings.haunting : lobbySettings.haunting}
							control={<Checkbox />}
						/>
					</DisabledTooltip>

					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							label={t('settings.lobbysettings.hear_imposters_invents')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								localLobbySettings.hearImpostorsInVents = newValue;
								setLocalLobbySettings(localLobbySettings);

								setSettings({
									type: 'setLobbySetting',
									action: ['hearImpostorsInVents', newValue],
								});
							}}
							value={
								canChangeLobbySettings ? localLobbySettings.hearImpostorsInVents : lobbySettings.hearImpostorsInVents
							}
							checked={
								canChangeLobbySettings ? localLobbySettings.hearImpostorsInVents : lobbySettings.hearImpostorsInVents
							}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							label={t('settings.lobbysettings.private_talk_invents')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								localLobbySettings.impostersHearImpostersInvent = newValue;
								setLocalLobbySettings(localLobbySettings);

								setSettings({
									type: 'setLobbySetting',
									action: ['impostersHearImpostersInvent', newValue],
								});
							}}
							value={
								canChangeLobbySettings
									? localLobbySettings.impostersHearImpostersInvent
									: lobbySettings.impostersHearImpostersInvent
							}
							checked={
								canChangeLobbySettings
									? localLobbySettings.impostersHearImpostersInvent
									: lobbySettings.impostersHearImpostersInvent
							}
							control={<Checkbox />}
						/>
					</DisabledTooltip>

					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							label={t('settings.lobbysettings.comms_sabotage_audio')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								localLobbySettings.commsSabotage = newValue;
								setLocalLobbySettings(localLobbySettings);

								setSettings({
									type: 'setLobbySetting',
									action: ['commsSabotage', newValue],
								});
							}}
							value={canChangeLobbySettings ? localLobbySettings.commsSabotage : lobbySettings.commsSabotage}
							checked={canChangeLobbySettings ? localLobbySettings.commsSabotage : lobbySettings.commsSabotage}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							label={t('settings.lobbysettings.hear_through_cameras')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								localLobbySettings.hearThroughCameras = newValue;
								setLocalLobbySettings(localLobbySettings);

								setSettings({
									type: 'setLobbySetting',
									action: ['hearThroughCameras', newValue],
								});
							}}
							value={canChangeLobbySettings ? localLobbySettings.hearThroughCameras : lobbySettings.hearThroughCameras}
							checked={
								canChangeLobbySettings ? localLobbySettings.hearThroughCameras : lobbySettings.hearThroughCameras
							}
							control={<Checkbox />}
						/>
					</DisabledTooltip>

					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							label={t('settings.lobbysettings.ghost_only')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								console.log('new vlaue of setting: ', newValue);
								openWarningDialog(
									t('settings.warning'),
									t('settings.lobbysettings.ghost_only_warning'),
									() => {
										localLobbySettings.meetingGhostOnly = false;
										localLobbySettings.deadOnly = newValue;
										setSettings({
											type: 'setLobbySetting',
											action: ['meetingGhostOnly', false],
										});
										setSettings({
											type: 'setLobbySetting',
											action: ['deadOnly', newValue],
										});
										setLocalLobbySettings(localLobbySettings);
									},
									newValue
								);
							}}
							value={canChangeLobbySettings ? localLobbySettings.deadOnly : lobbySettings.deadOnly}
							checked={canChangeLobbySettings ? localLobbySettings.deadOnly : lobbySettings.deadOnly}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							label={t('settings.lobbysettings.meetings_only')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								console.log('new vlaue of setting: ', newValue);
								openWarningDialog(
									t('settings.warning'),
									t('settings.lobbysettings.meetings_only_warning'),
									() => {
										localLobbySettings.meetingGhostOnly = newValue;
										localLobbySettings.deadOnly = false;
										setSettings({
											type: 'setLobbySetting',
											action: ['meetingGhostOnly', newValue],
										});
										setSettings({
											type: 'setLobbySetting',
											action: ['deadOnly', false],
										});
										setLocalLobbySettings(localLobbySettings);
									},
									newValue
								);
							}}
							value={canChangeLobbySettings ? localLobbySettings.meetingGhostOnly : lobbySettings.meetingGhostOnly}
							checked={canChangeLobbySettings ? localLobbySettings.meetingGhostOnly : lobbySettings.meetingGhostOnly}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
				</div>
				<Divider />
				<Typography variant="h6">{t('settings.audio.title')}</Typography>
				<TextField
					select
					label="Microphone"
					variant="outlined"
					color="secondary"
					value={settings.microphone}
					className={classes.shortcutField}
					SelectProps={{ native: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(ev) => {
						setSettings({
							type: 'setOne',
							action: ['microphone', ev.target.value],
						});
					}}
					onClick={updateDevices}
				>
					{microphones.map((d) => (
						<option key={d.id} value={d.id}>
							{d.label}
						</option>
					))}
				</TextField>
				{open && <MicrophoneSoundBar microphone={settings.microphone} />}
				<TextField
					select
					label={t('settings.audio.speaker')}
					variant="outlined"
					color="secondary"
					value={settings.speaker}
					className={classes.shortcutField}
					SelectProps={{ native: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(ev) => {
						setSettings({
							type: 'setOne',
							action: ['speaker', ev.target.value],
						});
					}}
					onClick={updateDevices}
				>
					{speakers.map((d) => (
						<option key={d.id} value={d.id}>
							{d.label}
						</option>
					))}
				</TextField>
				{open && <TestSpeakersButton t={t} speaker={settings.speaker} />}
				<RadioGroup
					value={settings.pushToTalkMode}
					onChange={(ev) => {
						setSettings({
							type: 'setOne',
							action: ['pushToTalkMode', Number(ev.target.value)],
						});
					}}
				>
					<FormControlLabel
						label={t('settings.audio.voice_activity')}
						value={pushToTalkOptions.VOICE}
						control={<Radio />}
					/>
					<FormControlLabel
						label={t('settings.audio.push_to_talk')}
						value={pushToTalkOptions.PUSH_TO_TALK}
						control={<Radio />}
					/>
					<FormControlLabel
						label={t('settings.audio.push_to_mute')}
						value={pushToTalkOptions.PUSH_TO_MUTE}
						control={<Radio />}
					/>
				</RadioGroup>
				<Divider />

				<div>
					<Typography id="input-slider" gutterBottom>
						{t('settings.audio.microphone_volume')}
					</Typography>
					<Grid container spacing={2}>
						<Grid item xs={3}>
							<Checkbox
								checked={settings.microphoneGainEnabled}
								onChange={(_, checked: boolean) => {
									setSettings({
										type: 'setOne',
										action: ['microphoneGainEnabled', checked],
									});
								}}
							/>
						</Grid>
						<Grid
							item
							xs={8}
							style={{
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<Slider
								disabled={!settings.microphoneGainEnabled}
								value={settings.microphoneGain}
								valueLabelDisplay="auto"
								min={0}
								max={300}
								step={1}
								onChange={(_, newValue: number | number[]) => {
									setSettings({
										type: 'setOne',
										action: ['microphoneGain', newValue],
									});
								}}
								aria-labelledby="input-slider"
							/>
						</Grid>
					</Grid>
					<Typography id="input-slider" gutterBottom>
						{t('settings.audio.microphone_sens')}
					</Typography>
					<Grid container spacing={2}>
						<Grid item xs={3}>
							<Checkbox
								checked={settings.micSensitivityEnabled}
								onChange={(_, checked: boolean) => {
									setSettings({
										type: 'setOne',
										action: ['micSensitivityEnabled', checked],
									});
								}}
							/>
						</Grid>
						<Grid
							item
							xs={8}
							style={{
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<Slider
								disabled={!settings.micSensitivityEnabled}
								value={+(1 - settings.micSensitivity).toFixed(2)}
								valueLabelDisplay="auto"
								min={0}
								max={1}
								color={settings.micSensitivity < 0.3 ? 'primary' : 'secondary'}
								step={0.05}
								onChange={(_, newValue: number | number[]) => {
									openWarningDialog(
										t('settings.warning'),
										t('settings.audio.microphone_sens_warning'),
										() => {
											setSettings({
												type: 'setOne',
												action: ['micSensitivity', 1 - (newValue as number)],
											});
										},
										newValue == 0.7 && settings.micSensitivity < 0.3
									);
								}}
								aria-labelledby="input-slider"
							/>
						</Grid>
					</Grid>
					<Divider />

					<Typography id="input-slider" gutterBottom>
						{t('settings.audio.crewvolume')}
					</Typography>
					<Grid container direction="row" justify="center" alignItems="center">
						<Grid item xs={11}>
							<Slider
								value={settings.ghostVolume}
								valueLabelDisplay="auto"
								onChange={(_, newValue: number | number[]) => {
									setSettings({
										type: 'setOne',
										action: ['ghostVolume', newValue],
									});
								}}
								aria-labelledby="input-slider"
							/>
						</Grid>
					</Grid>
					<Typography id="input-slider" gutterBottom>
						{t('settings.audio.mastervolume')}
					</Typography>
					<Grid container direction="row" justify="center" alignItems="center">
						<Grid item xs={11}>
							<Slider
								value={settings.masterVolume}
								valueLabelDisplay="auto"
								max={200}
								onChange={(_, newValue: number | number[]) => {
									setSettings({
										type: 'setOne',
										action: ['masterVolume', newValue],
									});
								}}
								aria-labelledby="input-slider"
							/>
						</Grid>
					</Grid>
				</div>
				<Divider />
				<Typography variant="h6">{t('settings.keyboard.title')}</Typography>
				<Grid container spacing={1}>
					<Grid item xs={12}>
						<TextField
							fullWidth
							spellCheck={false}
							color="secondary"
							label={t('settings.keyboard.push_to_talk')}
							value={settings.pushToTalkShortcut}
							className={classes.shortcutField}
							variant="outlined"
							onKeyDown={(ev) => {
								setShortcut(ev, 'pushToTalkShortcut');
							}}
							onMouseDown={(ev) => {
								setMouseShortcut(ev, 'pushToTalkShortcut');
							}}
						/>
					</Grid>
					<Grid item xs={6}>
						<TextField
							spellCheck={false}
							color="secondary"
							label={t('settings.keyboard.mute')}
							value={settings.muteShortcut}
							className={classes.shortcutField}
							variant="outlined"
							onKeyDown={(ev) => {
								setShortcut(ev, 'muteShortcut');
							}}
							onMouseDown={(ev) => {
								setMouseShortcut(ev, 'muteShortcut');
							}}
						/>
					</Grid>
					<Grid item xs={6}>
						<TextField
							spellCheck={false}
							color="secondary"
							label={t('settings.keyboard.deafen')}
							value={settings.deafenShortcut}
							className={classes.shortcutField}
							variant="outlined"
							onKeyDown={(ev) => {
								setShortcut(ev, 'deafenShortcut');
							}}
							onMouseDown={(ev) => {
								setMouseShortcut(ev, 'deafenShortcut');
							}}
						/>
					</Grid>
				</Grid>

				<Divider />
				<Typography variant="h6">{t('settings.overlay.title')}</Typography>
				<div>
					<FormControlLabel
						label={t('settings.overlay.always_on_top')}
						checked={settings.alwaysOnTop}
						onChange={(_, checked: boolean) => {
							setSettings({
								type: 'setOne',
								action: ['alwaysOnTop', checked],
							});
						}}
						control={<Checkbox />}
					/>
					<FormControlLabel
						label={t('settings.overlay.enabled')}
						checked={settings.enableOverlay}
						onChange={(_, checked: boolean) => {
							setSettings({
								type: 'setOne',
								action: ['enableOverlay', checked],
							});
						}}
						control={<Checkbox />}
					/>
					{settings.enableOverlay && (
						<>
							<FormControlLabel
								label={t('settings.overlay.compact')}
								checked={settings.compactOverlay}
								onChange={(_, checked: boolean) => {
									setSettings({
										type: 'setOne',
										action: ['compactOverlay', checked],
									});
								}}
								control={<Checkbox />}
							/>
							<FormControlLabel
								label={t('settings.overlay.meeting')}
								checked={settings.meetingOverlay}
								onChange={(_, checked: boolean) => {
									setSettings({
										type: 'setOne',
										action: ['meetingOverlay', checked],
									});
								}}
								control={<Checkbox />}
							/>
							<TextField
								fullWidth
								select
								label={t('settings.overlay.pos')}
								variant="outlined"
								color="secondary"
								value={settings.overlayPosition}
								className={classes.shortcutField}
								SelectProps={{ native: true }}
								InputLabelProps={{ shrink: true }}
								onChange={(ev) => {
									setSettings({
										type: 'setOne',
										action: ['overlayPosition', ev.target.value],
									});
								}}
								onClick={updateDevices}
							>
								<option value="hidden">{t('settings.overlay.locations.hidden')}</option>
								<option value="top">{t('settings.overlay.locations.top')}</option>
								<option value="bottom_left">{t('settings.overlay.locations.bottom')}</option>
								<option value="right">{t('settings.overlay.locations.right')}</option>
								<option value="right1">{t('settings.overlay.locations.right1')}</option>
								<option value="left">{t('settings.overlay.locations.left')}</option>
								<option value="left1">{t('settings.overlay.locations.left1')}</option>
							</TextField>
						</>
					)}
				</div>
				<Divider />
				<Typography variant="h6">{t('settings.advanced.title')}</Typography>
				<div>
					<FormControlLabel
						label={t('settings.advanced.nat_fix')}
						checked={settings.natFix}
						onChange={(_, checked: boolean) => {
							openWarningDialog(
								t('settings.warning'),
								t('settings.advanced.nat_fix_warning'),
								() => {
									setSettings({
										type: 'setOne',
										action: ['natFix', checked],
									});
								},
								checked
							);
						}}
						control={<Checkbox />}
					/>
				</div>

				<URLInput
					t={t}
					initialURL={settings.serverURL}
					onValidURL={(url: string) => {
						setSettings({
							type: 'setOne',
							action: ['serverURL', url],
						});
					}}
					className={classes.urlDialog}
				/>
				<Divider />
				<Typography variant="h6">{t('settings.beta.title')}</Typography>
				<div>
					<FormControlLabel
						label={t('settings.beta.mobilehost')}
						checked={settings.mobileHost}
						onChange={(_, checked: boolean) => {
							setSettings({
								type: 'setOne',
								action: ['mobileHost', checked],
							});
						}}
						control={<Checkbox />}
					/>
					<FormControlLabel
						label={t('settings.beta.vad_enabled')}
						checked={settings.vadEnabled}
						onChange={(_, checked: boolean) => {
							openWarningDialog(
								t('settings.warning'),
								t('settings.beta.vad_enabled_warning'),
								() => {
									setSettings({
										type: 'setOne',
										action: ['vadEnabled', checked],
									});
								},
								!checked
							);
						}}
						control={<Checkbox />}
					/>
					<FormControlLabel
						label={t('settings.beta.echocancellation')}
						checked={settings.echoCancellation}
						onChange={(_, checked: boolean) => {
							setSettings({
								type: 'setOne',
								action: ['echoCancellation', checked],
							});
						}}
						control={<Checkbox />}
					/>
					<FormControlLabel
						label={t('settings.beta.spatial_audio')}
						checked={settings.enableSpatialAudio}
						onChange={(_, checked: boolean) => {
							setSettings({
								type: 'setOne',
								action: ['enableSpatialAudio', checked],
							});
						}}
						control={<Checkbox />}
					/>
					<FormControlLabel
						label={t('settings.beta.noiseSuppression')}
						checked={settings.noiseSuppression}
						onChange={(_, checked: boolean) => {
							setSettings({
								type: 'setOne',
								action: ['noiseSuppression', checked],
							});
						}}
						control={<Checkbox />}
					/>
				</div>
				<TextField
					fullWidth
					select
					label={t('settings.language')}
					variant="outlined"
					color="secondary"
					value={settings.language}
					className={classes.shortcutField}
					SelectProps={{ native: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(ev) => {
						setSettings({
							type: 'setOne',
							action: ['language', ev.target.value],
						});
					}}
				>
					{Object.entries(languages).map(([key, value]) => (
						<option key={key} value={key}>
							{value.name}
						</option>
					))}
				</TextField>
				<Divider />
				<Typography variant="h6">{t('settings.streaming.title')}</Typography>
				<div>
					<FormControlLabel
						label={t('settings.streaming.hidecode')}
						checked={!settings.hideCode}
						onChange={(_, checked: boolean) => {
							setSettings({
								type: 'setOne',
								action: ['hideCode', !checked],
							});
						}}
						control={<Checkbox />}
					/>
					<FormControlLabel
						label={t('settings.streaming.obs_overlay')}
						checked={settings.obsOverlay}
						onChange={(_, checked: boolean) => {
							setSettings({
								type: 'setOne',
								action: ['obsOverlay', checked],
							});
							if (!settings.obsSecret) {
								setSettings({
									type: 'setOne',
									action: ['obsSecret', Math.random().toString(36).substr(2, 9).toUpperCase()],
								});
							}
						}}
						control={<Checkbox />}
					/>
					{settings.obsOverlay && (
						<>
							<FormControlLabel
								label={t('settings.streaming.voice_server_comp')}
								checked={settings.obsComptaibilityMode}
								onChange={(_, checked: boolean) => {
									openWarningDialog(
										t('settings.warning'),
										t('settings.streaming.voice_server_comp_warning'),
										() => {
											setSettings({
												type: 'setOne',
												action: ['obsComptaibilityMode', checked],
											});
										},
										!checked
									);
								}}
								control={<Checkbox />}
							/>

							<TextField
								fullWidth
								spellCheck={false}
								label={t('settings.streaming.obs_url')}
								value={`${
									(settings.obsComptaibilityMode && !settings.serverURL.includes('bettercrewl.ink')) ||
									settings.serverURL.includes('https')
										? 'https'
										: 'http'
								}://obs.bettercrewlink.app/?compact=${settings.compactOverlay ? '1' : '0'}&position=${
									settings.overlayPosition
								}&meeting=${settings.meetingOverlay ? '1' : '0'}&secret=${settings.obsSecret}&server=${
									settings.obsComptaibilityMode ? 'https://bettercrewl.ink' : settings.serverURL
								}`}
								variant="outlined"
								color="primary"
								InputProps={{
									readOnly: true,
								}}
							/>
						</>
					)}
				</div>
				<Divider />
				<Typography variant="h6">{t('settings.troubleshooting.title')}</Typography>
				<div>
					<DisabledTooltip disabled={!canResetSettings} title={t('settings.troubleshooting.warning')}>
						<Button
							disabled={!canResetSettings}
							variant="contained"
							color="secondary"
							onClick={() =>
								openWarningDialog(
									t('settings.warning'),
									t('settings.troubleshooting.restore_warning'),
									() => {
										resetDefaults();
									},
									true
								)
							}
						>
							{t('settings.troubleshooting.restore')}
						</Button>
					</DisabledTooltip>
				</div>
				<Alert className={classes.alert} severity="info" style={{ display: unsaved ? undefined : 'none' }}>
					{t('buttons.exit')}
				</Alert>
			</div>
		</Box>
	);
};

export default Settings;
