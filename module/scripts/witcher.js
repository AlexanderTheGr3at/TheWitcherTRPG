import { extendedRoll } from "./chat.js";
import { RollConfig } from "./rollConfig.js";

export function getRandomInt(max) {
	return Math.floor(Math.random() * (max + 1)) + 1;
}

/*
On any change to the Stats, the Derived Stats need to be updated appropriately. The base = Will+Body/2. HP and Stamina = base * 5.
Recovery and Stun = base. Stun can be a maximum of 10. Encumbrance = Body*10. Run = Speed*3. Leap = Run/5. Punch and Kick bonuses are determined 
with the Hand to Hand Table, page 48 of Witcher TRPG Handbook.

@param {Actor} actor - The actor passed in from actor-sheet.js to have its properties updated
*/
function updateDerived(actor) {
	const thisActor = actor;
	const stats = thisActor.system.stats;
	const base = Math.floor((stats.body.current + stats.will.current) / 2);
	const baseMax = Math.floor((stats.body.max + stats.will.max) / 2);
	const meleeBonus = Math.ceil((stats.body.current - 6) / 2) * 2;

	let intTotalModifiers = 0;
	let refTotalModifiers = 0;
	let dexTotalModifiers = 0;
	let bodyTotalModifiers = 0;
	let spdTotalModifiers = 0;
	let empTotalModifiers = 0;
	let craTotalModifiers = 0;
	let willTotalModifiers = 0;
	let luckTotalModifiers = 0;
	let intDivider = 1;
	let refDivider = 1;
	let dexDivider = 1;
	let bodyDivider = 1;
	let spdDivider = 1;
	let empDivider = 1;
	let craDivider = 1;
	let willDivider = 1;
	let luckDivider = 1;
	thisActor.system.stats.int.modifiers.forEach(item => intTotalModifiers += Number(item.value));
	thisActor.system.stats.ref.modifiers.forEach(item => refTotalModifiers += Number(item.value));
	thisActor.system.stats.dex.modifiers.forEach(item => dexTotalModifiers += Number(item.value));
	thisActor.system.stats.body.modifiers.forEach(item => bodyTotalModifiers += Number(item.value));
	thisActor.system.stats.spd.modifiers.forEach(item => spdTotalModifiers += Number(item.value));
	thisActor.system.stats.emp.modifiers.forEach(item => empTotalModifiers += Number(item.value));
	thisActor.system.stats.cra.modifiers.forEach(item => craTotalModifiers += Number(item.value));
	thisActor.system.stats.will.modifiers.forEach(item => willTotalModifiers += Number(item.value));
	thisActor.system.stats.luck.modifiers.forEach(item => luckTotalModifiers += Number(item.value));

	let activeEffects = thisActor.getList("effect").filter(e => e.system.isActive);
	activeEffects.forEach(item => {
		item.system.stats.forEach(stat => {
			switch (stat.stat) {
				case "WITCHER.Actor.Stat.Int":
					if (stat.modifier.includes("/")) { intDivider = Number(stat.modifier.replace("/", '')); }
					else { intTotalModifiers += Number(stat.modifier) }
					break;
				case "WITCHER.Actor.Stat.Ref":
					if (stat.modifier.includes("/")) { refDivider = Number(stat.modifier.replace("/", '')); }
					else { refTotalModifiers += Number(stat.modifier) }
					break;
				case "WITCHER.Actor.Stat.Dex":
					if (stat.modifier.includes("/")) { dexDivider = Number(stat.modifier.replace("/", '')); }
					else { dexTotalModifiers += Number(stat.modifier) }
					break;
				case "WITCHER.Actor.Stat.Body":
					if (stat.modifier.includes("/")) { bodyDivider = Number(stat.modifier.replace("/", '')); }
					else { bodyTotalModifiers += Number(stat.modifier) }
					break;
				case "WITCHER.Actor.Stat.Spd":
					if (stat.modifier.includes("/")) { spdDivider = Number(stat.modifier.replace("/", '')); }
					else { spdTotalModifiers += Number(stat.modifier) }
					break;
				case "WITCHER.Actor.Stat.Emp":
					if (stat.modifier.includes("/")) { empDivider = Number(stat.modifier.replace("/", '')); }
					else { empTotalModifiers += Number(stat.modifier) }
					break;
				case "WITCHER.Actor.Stat.Cra":
					if (stat.modifier.includes("/")) { craDivider = Number(stat.modifier.replace("/", '')); }
					else { craTotalModifiers += Number(stat.modifier) }
					break;
				case "WITCHER.Actor.Stat.Will":
					if (stat.modifier.includes("/")) { willDivider = Number(stat.modifier.replace("/", '')); }
					else { willTotalModifiers += Number(stat.modifier) }
					break;
				case "WITCHER.Actor.Stat.Luck":
					if (stat.modifier.includes("/")) { luckDivider = Number(stat.modifier.replace("/", '')); }
					else { luckTotalModifiers += Number(stat.modifier) }
					break;
			}
		})
	});

	let stunTotalModifiers = 0;
	let runTotalModifiers = 0;
	let leapTotalModifiers = 0;
	let encTotalModifiers = 0;
	let recTotalModifiers = 0;
	let wtTotalModifiers = 0;
	let stunDivider = 1;
	let runDivider = 1;
	let leapDivider = 1;
	let encDivider = 1;
	let recDivider = 1;
	let wtDivider = 1;
	thisActor.system.coreStats.stun.modifiers.forEach(item => stunTotalModifiers += Number(item.value));
	thisActor.system.coreStats.run.modifiers.forEach(item => runTotalModifiers += Number(item.value));
	thisActor.system.coreStats.leap.modifiers.forEach(item => leapTotalModifiers += Number(item.value));
	thisActor.system.coreStats.enc.modifiers.forEach(item => encTotalModifiers += Number(item.value));
	thisActor.system.coreStats.rec.modifiers.forEach(item => recTotalModifiers += Number(item.value));
	thisActor.system.coreStats.woundTreshold.modifiers.forEach(item => wtTotalModifiers += Number(item.value));

	let curentEncumbrance = (thisActor.system.stats.body.max + bodyTotalModifiers) * 10 + encTotalModifiers
	var totalWeights = 0
	thisActor.items.forEach(item => { if (item.system.weight && item.system.quantity) { totalWeights += (Number(item.system.weight) * Number(item.system.quantity)) } })
	totalWeights += calc_currency_weight(thisActor.system.currency);
	let encDiff = 0
	if (curentEncumbrance < totalWeights) {
		encDiff = Math.ceil((totalWeights - curentEncumbrance) / 5)
	}
	let armorEnc = getArmorEcumbrance(thisActor)

	activeEffects.forEach(item => {
		item.system.derived.forEach(derived => {
			switch (derived.derivedStat) {
				case "WITCHER.Actor.CoreStat.Stun":
					if (derived.modifier.includes("/")) { stunDivider = Number(derived.modifier.replace("/", '')); }
					else { stunTotalModifiers += Number(derived.modifier) }
					break;
				case "WITCHER.Actor.CoreStat.Run":
					if (derived.modifier.includes("/")) { runDivider = Number(derived.modifier.replace("/", '')); }
					else { runTotalModifiers += Number(derived.modifier) }
					break;
				case "WITCHER.Actor.CoreStat.Leap":
					if (derived.modifier.includes("/")) { leapDivider = Number(derived.modifier.replace("/", '')); }
					else { leapTotalModifiers += Number(derived.modifier) }
					break;
				case "WITCHER.Actor.CoreStat.Enc":
					if (derived.modifier.includes("/")) { encDivider = Number(derived.modifier.replace("/", '')); }
					else { encTotalModifiers += Number(derived.modifier) }
					break;
				case "WITCHER.Actor.CoreStat.Rec":
					if (derived.modifier.includes("/")) { recDivider = Number(derived.modifier.replace("/", '')); }
					else { recTotalModifiers += Number(derived.modifier) }
					break;
				case "WITCHER.Actor.CoreStat.woundTreshold":
					if (derived.modifier.includes("/")) { wtDivider = Number(derived.modifier.replace("/", '')); }
					else { wtTotalModifiers += Number(derived.modifier) }
					break;
			}
		})
	});

	let curInt = Math.floor((thisActor.system.stats.int.max + intTotalModifiers) / intDivider);
	let curRef = Math.floor((thisActor.system.stats.ref.max + refTotalModifiers - armorEnc - encDiff) / refDivider);
	let curDex = Math.floor((thisActor.system.stats.dex.max + dexTotalModifiers - armorEnc - encDiff) / dexDivider);
	let curBody = Math.floor((thisActor.system.stats.body.max + bodyTotalModifiers) / bodyDivider);
	let curSpd = Math.floor((thisActor.system.stats.spd.max + spdTotalModifiers - encDiff) / spdDivider);
	let curEmp = Math.floor((thisActor.system.stats.emp.max + empTotalModifiers) / empDivider);
	let curCra = Math.floor((thisActor.system.stats.cra.max + craTotalModifiers) / craDivider);
	let curWill = Math.floor((thisActor.system.stats.will.max + willTotalModifiers) / willDivider);
	let curLuck = Math.floor((thisActor.system.stats.luck.max + luckTotalModifiers) / luckDivider);
	let isDead = false;
	let isWounded = false;
	let HPvalue = thisActor.system.derivedStats.hp.value;
	if (HPvalue <= 0) {
		isDead = true
		curInt = Math.floor((thisActor.system.stats.int.max + intTotalModifiers) / 3 / intDivider)
		curRef = Math.floor((thisActor.system.stats.ref.max + refTotalModifiers - armorEnc - encDiff) / 3 / dexDivider)
		curDex = Math.floor((thisActor.system.stats.dex.max + dexTotalModifiers - armorEnc - encDiff) / 3 / refDivider)
		curBody = Math.floor((thisActor.system.stats.body.max + bodyTotalModifiers) / 3 / bodyDivider)
		curSpd = Math.floor((thisActor.system.stats.spd.max + spdTotalModifiers - encDiff) / 3 / spdDivider)
		curEmp = Math.floor((thisActor.system.stats.emp.max + empTotalModifiers) / 3 / empDivider)
		curCra = Math.floor((thisActor.system.stats.cra.max + craTotalModifiers) / 3 / craDivider)
		curWill = Math.floor((thisActor.system.stats.will.max + willTotalModifiers) / 3 / willDivider)
		curLuck = Math.floor((thisActor.system.stats.luck.max + luckTotalModifiers) / 3 / luckDivider)
	}
	else if (HPvalue < thisActor.system.coreStats.woundTreshold.current > 0) {
		isWounded = true
		curRef = Math.floor((thisActor.system.stats.ref.max + refTotalModifiers - armorEnc - encDiff) / 2 / refDivider)
		curDex = Math.floor((thisActor.system.stats.dex.max + dexTotalModifiers - armorEnc - encDiff) / 2 / dexDivider)
		curInt = Math.floor((thisActor.system.stats.int.max + intTotalModifiers) / 2 / intDivider)
		curWill = Math.floor((thisActor.system.stats.will.max + willTotalModifiers) / 2 / willDivider)
	}

	let hpTotalModifiers = 0;
	let staTotalModifiers = 0;
	let resTotalModifiers = 0;
	let focusTotalModifiers = 0;
	let hpDivider = 1;
	let staDivider = 1;
	thisActor.system.derivedStats.hp.modifiers.forEach(item => hpTotalModifiers += Number(item.value));
	thisActor.system.derivedStats.sta.modifiers.forEach(item => staTotalModifiers += Number(item.value));
	thisActor.system.derivedStats.resolve.modifiers.forEach(item => resTotalModifiers += Number(item.value));
	thisActor.system.derivedStats.focus.modifiers.forEach(item => focusTotalModifiers += Number(item.value));
	activeEffects.forEach(item => {
		item.system.derived.forEach(derived => {
			switch (derived.derivedStat) {
				case "WITCHER.Actor.DerStat.HP":
					if (derived.modifier.includes("/")) { hpDivider = Number(derived.modifier.replace("/", '')); }
					else { hpTotalModifiers += Number(derived.modifier) }
					break;
				case "WITCHER.Actor.DerStat.Sta":
					if (derived.modifier.includes("/")) { staDivider = Number(derived.modifier.replace("/", '')); }
					else { staTotalModifiers += Number(derived.modifier) }
					break;
			}
		})
	});

	let curHp = thisActor.system.derivedStats.hp.max + hpTotalModifiers;
	let curSta = thisActor.system.derivedStats.sta.max + staTotalModifiers;
	let curRes = thisActor.system.derivedStats.resolve.max + resTotalModifiers;
	let curFocus = thisActor.system.derivedStats.focus.max + focusTotalModifiers;


	let unmodifiedMaxHp = baseMax * 5

	if (thisActor.system.customStat != true) {
		curHp = Math.floor((base * 5 + hpTotalModifiers) / hpDivider)
		curSta = Math.floor((base * 5 + staTotalModifiers) / staDivider)
		curRes = (Math.floor((curWill + curInt) / 2) * 5) + resTotalModifiers
		curFocus = (Math.floor((curWill + curInt) / 2) * 3) + focusTotalModifiers
	}

	thisActor.update({
		'system.deathStateApplied': isDead,
		'system.woundTresholdApplied': isWounded,
		'system.stats.int.current': curInt,
		'system.stats.ref.current': curRef,
		'system.stats.dex.current': curDex,
		'system.stats.body.current': curBody,
		'system.stats.spd.current': curSpd,
		'system.stats.emp.current': curEmp,
		'system.stats.cra.current': curCra,
		'system.stats.will.current': curWill,
		'system.stats.luck.current': curLuck,

		'system.derivedStats.hp.max': curHp,
		'system.derivedStats.hp.unmodifiedMax': unmodifiedMaxHp,
		'system.derivedStats.sta.max': curSta,
		'system.derivedStats.resolve.max': curRes,
		'system.derivedStats.focus.max': curFocus,

		'system.coreStats.stun.current': Math.floor((Math.clamped(base, 1, 10) + stunTotalModifiers) / stunDivider),
		'system.coreStats.stun.max': Math.clamped(baseMax, 1, 10),

		'system.coreStats.enc.current': Math.floor((stats.body.current * 10 + encTotalModifiers) / encDivider),
		'system.coreStats.enc.max': stats.body.current * 10,

		'system.coreStats.run.current': Math.floor((stats.spd.current * 3 + runTotalModifiers) / runDivider),
		'system.coreStats.run.max': stats.spd.current * 3,

		'system.coreStats.leap.current': Math.floor((stats.spd.current * 3 / 5) + leapTotalModifiers) / leapDivider,
		'system.coreStats.leap.max': Math.floor(stats.spd.max * 3 / 5),

		'system.coreStats.rec.current': Math.floor((base + recTotalModifiers) / recDivider),
		'system.coreStats.rec.max': baseMax,

		'system.coreStats.woundTreshold.current': Math.floor((baseMax + wtTotalModifiers) / wtDivider),
		'system.coreStats.woundTreshold.max': baseMax,

		'system.attackStats.meleeBonus': meleeBonus,
		'system.attackStats.punch.value': `1d6+${meleeBonus}`,
		'system.attackStats.kick.value': `1d6+${4 + meleeBonus}`,
	});
}

function getArmorEcumbrance(actor) {
	let encumbranceModifier = 0
	let armors = actor.items.filter(item => item.type == "armor");
	armors.forEach(item => {
		if (item.system.equipped) {
			encumbranceModifier += item.system.encumb
		}
	});
	return encumbranceModifier
}

function rollSkillCheck(actor, skillMapEntry) {
	const tolerated = ["tolerated", "toleratedFeared"]
	const feared = ["feared", "toleratedFeared", "hatedFeared"]
	const hated = ["hated", "hatedFeared"]

	let attribute = skillMapEntry.attribute;
	let attributeLabel = game.i18n.localize(attribute.label);
	let attributeValue = actor.system.stats[attribute.name].current;

	let skillName = skillMapEntry.name;
	let skillLabel = game.i18n.localize(skillMapEntry.label)
	let skillValue = actor.system.skills[attribute.name][skillName].value;
	let skill = actor.system.skills[attribute.name][skillName]

	let displayRollDetails = game.settings.get("TheWitcherTRPG", "displayRollsDetails")

	let messageData = {
		speaker: ChatMessage.getSpeaker({ actor: actor }),
		flavor: `${attributeLabel}: ${skillLabel} Check`,
	}

	let rollFormula;
	if (actor.system.dontAddAttr) {
		rollFormula = !displayRollDetails ? `1d10+${skillValue}` : `1d10+${skillValue}[${skillLabel}]`;
	}
	else {
		rollFormula = !displayRollDetails ? `1d10+${attributeValue}+${skillValue}` : `1d10+${attributeValue}[${attributeLabel}]+${skillValue}[${skillLabel}]`;
	}

	if (actor.type == "character") {
		// core rulebook page 21
		if (attribute.name == "emp" && (skillName == "charisma" || skillName == "leadership" || skillName == "persuasion" || skillName == "seduction")) {
			if (tolerated.includes(actor.system.general.socialStanding)) {
				rollFormula += !displayRollDetails ? `-1` : `-1[${game.i18n.localize("WITCHER.socialStanding.tolerated")}]`;
			} else if (hated.includes(actor.system.general.socialStanding)) {
				rollFormula += !displayRollDetails ? `-2` : `-2[${game.i18n.localize("WITCHER.socialStanding.hated")}]`;
			}
		}
		if (attribute.name == "emp" && skillName == "charisma" && feared.includes(actor.system.general.socialStanding)) {
			rollFormula += !displayRollDetails ? `-1` : `-1[${game.i18n.localize("WITCHER.socialStanding.feared")}]`;
		}
		if (attribute.name == "will" && skillName == "intimidation" && feared.includes(actor.system.general.socialStanding)) {
			rollFormula += !displayRollDetails ? `+1` : `+1[${game.i18n.localize("WITCHER.socialStanding.feared")}]`;
		}
	}

	if (skill.modifiers) {
		rollFormula = addModifiers(skill.modifiers, rollFormula)
	}

	let armorEnc = getArmorEcumbrance(actor)
	if (armorEnc > 0 && (skillName == "hexweave" || skillName == "ritcraft" || skillName == "spellcast")) {
		rollFormula += !displayRollDetails ? `-${armorEnc}` : `-${armorEnc}[${game.i18n.localize("WITCHER.Armor.EncumbranceValue")}]`
	}

	let activeEffects = actor.getList("effect").filter(e => e.system.isActive);
	activeEffects.forEach(item => {
		item.system.skills.forEach(effectSkill => {
			if (skillLabel == game.i18n.localize(effectSkill.skill)) {
				if (effectSkill.modifier.includes("/")) {
					rollFormula += !displayRollDetails ? `/${Number(effectSkill.modifier.replace("/", ''))}` : `/${Number(effectSkill.modifier.replace("/", ''))}[${item.name}]`
				}
				else {
					rollFormula += !displayRollDetails ? `+${effectSkill.modifier}` : `+${effectSkill.modifier}[${item.name}]`
				}
			}
		})
	});

	new Dialog({
		title: `${game.i18n.localize("WITCHER.Dialog.Skill")}: ${skillLabel}`,
		content: `<label>${game.i18n.localize("WITCHER.Dialog.attackCustom")}: <input name="customModifiers" value=0></label>`,
		buttons: {
			LocationRandom: {
				label: game.i18n.localize("WITCHER.Button.Continue"),
				callback: async html => {
					let customAtt = html.find("[name=customModifiers]")[0].value;
					if (customAtt < 0) {
						rollFormula += !displayRollDetails ? `${customAtt}` : `${customAtt}[${game.i18n.localize("WITCHER.Settings.Custom")}]`
					}
					if (customAtt > 0) {
						rollFormula += !displayRollDetails ? `+${customAtt}` : `+${customAtt}[${game.i18n.localize("WITCHER.Settings.Custom")}]`
					}
					let config = new RollConfig()
					config.showCrit = true
					config.showSuccess = true
					await extendedRoll(rollFormula, messageData, config)
				}
			}
		}
	}).render(true)
}

function genId() {
	return randomID(16);
};

function calc_currency_weight(currency) {
	let totalPieces = 0;
	totalPieces += Number(currency.bizant);
	totalPieces += Number(currency.ducat);
	totalPieces += Number(currency.lintar);
	totalPieces += Number(currency.floren);
	totalPieces += Number(currency.crown);
	totalPieces += Number(currency.oren);
	totalPieces += Number(currency.falsecoin);
	return Number(totalPieces * 0.001)
}

function addModifiers(modifiers, formula) {
	let displayRollDetails = game.settings.get("TheWitcherTRPG", "displayRollsDetails")
	modifiers?.forEach(mod => {
		if (mod.value < 0) {
			formula += !displayRollDetails ? `${mod.value}` : `${mod.value}[${mod.name}]`
		}
		if (mod.value > 0) {
			formula += !displayRollDetails ? `+${mod.value}` : `+${mod.value}[${mod.name}]`
		}
	});
	return formula;
}

export { updateDerived, rollSkillCheck, genId, calc_currency_weight, addModifiers };