import { buttonDialog, extendedRoll } from "./chat.js";
import { addModifiers } from "./witcher.js";
import { RollConfig } from "./rollConfig.js";
import { WITCHER } from "../setup/config.js";

async function ApplyNormalDamage(actor, totalDamage, messageId) {
  applyDamage(actor, totalDamage, messageId, "hp")
}

async function ApplyNonLethalDamage(actor, totalDamage, messageId) {
  applyDamage(actor, totalDamage, messageId, "sta")
}

async function applyDamage(actor, totalDamage, messageId, derivedStat) {
  let damageOptions = game.messages.get(messageId).getFlag('TheWitcherTRPG', 'damageOptions')
  let damage = game.messages.get(messageId).getFlag('TheWitcherTRPG', 'damage')
  let armors = actor.getList("armor").filter(a => a.system.equipped);

  let headArmors = armors.filter(h => h.system.location == "Head" || h.system.location == "FullCover")
  let torsoArmors = armors.filter(t => t.system.location == "Torso" || t.system.location == "FullCover")
  let legArmors = armors.filter(l => l.system.location == "Leg" || l.system.location == "FullCover")

  let naturalArmors = armors.filter(n => n.system.type == "Natural")

  let damageTypeloc = `WITCHER.Armor.${damage.type}`;

  const locationOptions = `
    <option value="Empty"></option>
    <option value="Head"> ${game.i18n.localize("WITCHER.Dialog.attackHead")} </option>
    <option value="Torso"> ${game.i18n.localize("WITCHER.Dialog.attackTorso")} </option>
    <option value="L. Arm"> ${game.i18n.localize("WITCHER.Dialog.attackLArm")} </option>
    <option value="R. Arm"> ${game.i18n.localize("WITCHER.Dialog.attackRArm")} </option>
    <option value="L. Leg"> ${game.i18n.localize("WITCHER.Dialog.attackLLeg")} </option>
    <option value="R. Leg"> ${game.i18n.localize("WITCHER.Dialog.attackRLeg")} </option>
    <option value="Tail/Wing"> ${game.i18n.localize("WITCHER.Dialog.attackTail")} </option>
    `;

  const silverOptions = `
    <option></option>
    <option value="1d6">1d6</option>
    <option value="2d6">2d6</option>
    <option value="3d6">3d6</option>
    <option value="4d6">4d6</option>
    <option value="5d6">5d6</option>
    `;

  let location = damage.location;
  let content = `<label>${game.i18n.localize("WITCHER.Damage.damageType")}: <b>${game.i18n.localize(damageTypeloc)}</b></label> <br />
      <label>${game.i18n.localize("WITCHER.Damage.CurrentLocation")}: <b>${location.alias}</b></label> <br />
      <label>${game.i18n.localize("WITCHER.Damage.ChangeLocation")}: <select name="changeLocation">${locationOptions}</select></label> <br />`

  if (actor.type == "monster") {
    content += `<label>${game.i18n.localize("WITCHER.Damage.resistSilver")}: <input type="checkbox" name="resistNonSilver"></label><br />
                    <label>${game.i18n.localize("WITCHER.Damage.resistMeteorite")}: <input type="checkbox" name="resistNonMeteorite"></label><br />`
  }

  content += `<label>${game.i18n.localize("WITCHER.Damage.isVulnerable")}: <input type="checkbox" name="vulnerable"></label><br />
    <label>${game.i18n.localize("WITCHER.Damage.oilDmg")}: <input type="checkbox" name="oilDmg"></label><br />
    <label>${game.i18n.localize("WITCHER.Damage.silverDmg")}: <select name="silverDmg">${silverOptions}</select></label><br />`

  let cancel = true;
  let resistSilver = false;
  let resistMeteorite = false;
  let newLocation = false;
  let isVulnerable = false;
  let addOilDmg = false;
  let silverDmg;

  let infoTotalDmg = totalDamage

  let dialogData = {
    buttons: [
      [`${game.i18n.localize("WITCHER.Button.Continue")}`,
      (html) => {
        newLocation = html.find("[name=changeLocation]")[0].value;
        resistSilver = html.find("[name=resistNonSilver]").prop("checked");
        resistMeteorite = html.find("[name=resistNonMeteorite]").prop("checked");
        isVulnerable = html.find("[name=vulnerable]").prop("checked");
        addOilDmg = html.find("[name=oilDmg]").prop("checked");
        silverDmg = html.find("[name=silverDmg]")[0].value;
        cancel = false
      }]],
    title: game.i18n.localize("WITCHER.Context.applyDmg"),
    content: content
  }

  await buttonDialog(dialogData)

  if (cancel) {
    return
  }

  if (silverDmg) {
    let silverRoll = await new Roll(silverDmg).evaluate({ async: true })
    totalDamage = Number(totalDamage) + silverRoll.total
    infoTotalDmg += `+${silverRoll.total}[${game.i18n.localize("WITCHER.Damage.silver")}]`
  }

  if (newLocation != "Empty") {
    location = actor.getLocationObject(newLocation);
  }

  if (addOilDmg) {
    totalDamage = Number(totalDamage) + 5
    infoTotalDmg += `+5[${game.i18n.localize("WITCHER.Damage.oil")}]`
  }

  let shield = actor.system.derivedStats.shield.value;
  if (totalDamage < shield) {
    actor.update({ 'system.derivedStats.shield.value': shield - totalDamage });
    let messageContent = `${game.i18n.localize("WITCHER.Damage.initial")}: <span class="error-display">${infoTotalDmg}</span><br />
    ${game.i18n.localize("WITCHER.Damage.shield")}: <span class="error-display">${shield}</span><br />
    ${game.i18n.localize("WITCHER.Damage.ToMuchShield")}
    `;
    let messageData = {
      user: game.user.id,
      content: messageContent,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: actor.getNoDamageFlags(),
    }
    ChatMessage.create(messageData);
    return;
  }
  else {
    actor.update({ 'system.derivedStats.shield.value': 0 });
    totalDamage -= shield;
  }

  let armorSet = {};
  let totalSP = 0
  let displaySP = ""
  let values;

  //todo refactor
  switch (location.name) {
    case "Head":
      armorSet = getArmors(headArmors)
      values = getArmorSp(armorSet, "headStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
    case "Torso":
      armorSet = getArmors(torsoArmors)
      values = getArmorSp(armorSet, "torsoStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
    case "R. Arm":
      armorSet = getArmors(torsoArmors)
      values = getArmorSp(armorSet, "rightArmStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
    case "L. Arm":
      armorSet = getArmors(torsoArmors)
      values = getArmorSp(armorSet, "leftArmStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
    case "R. Leg":
      armorSet = getArmors(legArmors)
      values = getArmorSp(armorSet, "rightLegStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
    case "L. Leg":
      armorSet = getArmors(legArmors)
      values = getArmorSp(armorSet, "leftLegStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
  }

  if (actor.type == "monster") {
    //todo refactor
    switch (location.name) {
      case "Head":
        totalSP += actor.system.armorHead;
        displaySP += actor.system.armorHead;
        break;
      case "Torso":
      case "R. Arm":
      case "L. Arm":
        totalSP += actor.system.armorUpper;
        displaySP += actor.system.armorUpper;
        break;
      case "R. Leg":
      case "L. Leg":
        totalSP += actor.system.armorLower;
        displaySP += actor.system.armorLower;
        break;
      case "Tail/Wing":
        totalSP += actor.system.armorTailWing;
        displaySP += actor.system.armorTailWing;
        break;
    }
  }

  naturalArmors.forEach(armor => {
    //todo refactor
    switch (location.name) {
      case "Head": totalSP = Number(totalSP) + Number(armor?.system.headStopping); displaySP += `+${armor?.system.headStopping}`; break;
      case "Torso": totalSP = Number(totalSP) + Number(armor?.system.torsoStopping); displaySP += `+${armor?.system.torsoStopping}`; break;
      case "R. Arm": totalSP = Number(totalSP) + Number(armor?.system.rightArmStopping); displaySP += `+${armor?.system.rightArmStopping}`; break;
      case "L. Arm": totalSP = Number(totalSP) + Number(armor?.system.leftArmStopping); displaySP += `+${armor?.system.leftArmStopping}`; break;
      case "R. Leg": totalSP = Number(totalSP) + Number(armor?.system.rightLegStopping); displaySP += `+${armor?.system.rightLegStopping}`; break;
      case "L. Leg": totalSP = Number(totalSP) + Number(armor?.system.leftLegStopping); displaySP += `+${armor?.system.leftLegStopping}`; break;
    }
    displaySP += `[${game.i18n.localize("WITCHER.Armor.Natural")}]`;
  })

  if (actor.type == "character" && !armorSet && !naturalArmors) {
    return
  }

  if (damageOptions.improvedArmorPiercing) {
    totalSP = totalSP / 2;
    displaySP = displaySP / 2;
  }

  totalDamage -= totalSP < 0 ? 0 : totalSP;

  let infoAfterSPReduction = totalDamage < 0 ? 0 : totalDamage

  if (totalDamage <= 0) {
    let messageContent = `${game.i18n.localize("WITCHER.Damage.initial")}: <span class="error-display">${infoTotalDmg}</span><br />
        ${game.i18n.localize("WITCHER.Damage.totalSP")}: <span class="error-display">${displaySP}</span><br />
        ${game.i18n.localize("WITCHER.Damage.afterSPReduct")} <span class="error-display">${infoAfterSPReduction}</span><br /><br />
        ${game.i18n.localize("WITCHER.Damage.NotEnough")}
        `;
    let messageData = {
      user: game.user.id,
      content: messageContent,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: actor.getNoDamageFlags(),
    }
    let rollResult = await new Roll("1").evaluate({ async: true })
    rollResult.toMessage(messageData)
    return
  }

  totalDamage *= location.locationFormula
  let infoAfterLocation = totalDamage

  let ignoreArmorResistance = damageOptions.armorPiercing || damageOptions.improvedArmorPiercing;
  if (!ignoreArmorResistance && (armorSet["lightArmor"]?.system[damage.type] || armorSet["mediumArmor"]?.system[damage.type] || armorSet["heavyArmor"]?.system[damage.type] || naturalArmors.find(armor => armor.system[damage.type]))) {
    totalDamage *= 0.5
  }

  if (resistSilver || resistMeteorite) {
    totalDamage *= 0.5
  }
  if (isVulnerable) {
    totalDamage *= 2
  }
  let infoAfterResistance = totalDamage

  let spDamage = damageOptions.ablating ? Math.floor((await new Roll("1d6/2+1").evaluate()).total) : 1
  //todo refactor
  switch (location.name) {
    case "Head":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.headStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.headStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.headStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.headStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.headStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.headStopping': heavyArmorSP })
      }
      break;
    case "Torso":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.torsoStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.torsoStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.torsoStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.torsoStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.torsoStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.torsoStopping': heavyArmorSP })
      }
      break;
    case "R. Arm":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.rightArmStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.rightArmStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.rightArmStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.rightArmStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.rightArmStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.rightArmStopping': heavyArmorSP })
      }
      break;
    case "L. Arm":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.leftArmStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.leftArmStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.leftArmStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.leftArmStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.leftArmStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.leftArmStopping': heavyArmorSP })
      }
      break;
    case "R. Leg":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.rightLegStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.rightLegStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.rightLegStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.rightLegStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.rightLegStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.rightLegStopping': heavyArmorSP })
      }
      break;
    case "L. Leg":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.leftLegStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.leftLegStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.leftLegStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.leftLegStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.leftLegStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.leftLegStopping': heavyArmorSP })
      }
      break;
  }

  let messageContent = `${game.i18n.localize("WITCHER.Damage.initial")}: <span class="error-display">${infoTotalDmg}</span> <br />
    ${game.i18n.localize("WITCHER.Damage.totalSP")}: <span class="error-display">${displaySP} ${damageOptions.improvedArmorPiercing ? game.i18n.localize("WITCHER.Damage.improvedArmorPiercing") : ''}</span><br />
    ${game.i18n.localize("WITCHER.Damage.afterSPReduct")}: <span class="error-display">${infoAfterSPReduction} ${(damageOptions.improvedArmorPiercing || damageOptions.armorPiercing) ? game.i18n.localize("WITCHER.Damage.armorPiercing") : ''}</span><br />
    ${game.i18n.localize("WITCHER.Damage.afterLocationModifier")}: <span class="error-display">${infoAfterLocation}</span><br />
    ${game.i18n.localize("WITCHER.Damage.afterResistances")}: <span class="error-display">${infoAfterResistance}</span><br /><br />
    ${game.i18n.localize("WITCHER.Damage.totalApplied")}: <span class="error-display">${Math.floor(totalDamage)}</span>
    `;
  if (damageOptions.ablating) {
    messageContent += `<br/>${game.i18n.localize("WITCHER.Damage.ablated")}: <span class="error-display">${spDamage}</span>`
  }

  let messageData = {
    user: game.user.id,
    content: messageContent,
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    flags: actor.getDamageFlags(),
  }
  let rollResult = await new Roll("1").evaluate({ async: true })
  rollResult.toMessage(messageData)

  actor?.update({
    [`system.derivedStats.${derivedStat}.value`]: actor.system.derivedStats.hp.value - Math.floor(totalDamage)
  });
}

function getArmors(armors) {
  let lightCount = 0, mediumCount = 0, heavyCount = 0;
  let lightArmor, mediumArmor, heavyArmor;
  armors.forEach(item => {
    if (item.system.type == "Light") {
      lightCount++;
      lightArmor = item
    }
    if (item.system.type == "Medium") {
      mediumCount++;
      mediumArmor = item
    }
    if (item.system.type == "Heavy") {
      heavyCount++;
      heavyArmor = item
    }
  });
  if (lightCount > 1 || mediumCount > 1 || heavyCount > 1) {
    ui.notifications.error(game.i18n.localize("WITCHER.Armor.tooMuch"))
    return
  }
  return {
    lightArmor: lightArmor,
    mediumArmor: mediumArmor,
    heavyArmor: heavyArmor
  };
}

function getArmorSp(armorSet, location) {
  return getStackedArmorSp(armorSet["lightArmor"]?.system[location], armorSet["mediumArmor"]?.system[location], armorSet["heavyArmor"]?.system[location])
}

function getStackedArmorSp(lightArmorSP, mediumArmorSP, heavyArmorSP) {
  let totalSP = 0
  let displaySP = ""

  if (heavyArmorSP) {
    totalSP = heavyArmorSP
    displaySP = heavyArmorSP
  }

  if (mediumArmorSP) {
    if (heavyArmorSP) {
      let diff = getArmorDiffBonus(heavyArmorSP, mediumArmorSP)
      totalSP = Number(totalSP) + Number(diff)
      displaySP += "+" + diff
    }
    else {
      displaySP = mediumArmorSP
      totalSP = mediumArmorSP
    }
  }

  if (lightArmorSP) {
    if (mediumArmorSP) {
      let diff = getArmorDiffBonus(mediumArmorSP, lightArmorSP)
      totalSP = Number(totalSP) + Number(diff)
      displaySP += `+${diff}[${game.i18n.localize("WITCHER.Armor.LayerBonus")}]`
    }
    else if (heavyArmorSP) {
      let diff = getArmorDiffBonus(heavyArmorSP, lightArmorSP)
      totalSP = Number(totalSP) + Number(diff)
      displaySP += `+${diff}[${game.i18n.localize("WITCHER.Armor.LayerBonus")}]`
    }
    else {
      totalSP = lightArmorSP
      displaySP = lightArmorSP
    }
  }
  return [displaySP, totalSP]
}

function getArmorDiffBonus(OverArmor, UnderArmor) {
  let diff = OverArmor - UnderArmor

  if (UnderArmor <= 0 || OverArmor <= 0) {
    return 0
  }

  if (diff < 0) { diff *= -1 }

  if (diff > 20) {
    return 0
  } else if (diff > 15) {
    return 2
  } else if (diff > 9) {
    return 3
  } else if (diff > 5) {
    return 4
  } else if (diff >= 0) {
    return 5
  }
  return 0

}

function BlockAttack(actor) {
  let weapons = actor.items.filter(function (item) { return item.type == "weapon" && !item.system.isAmmo && WITCHER.meleeSkills.includes(item.system.attackSkill) });
  let shields = actor.items.filter(function (item) { return item.type == "armor" && item.system.location == "Shield" });
  //todo do we need the ability to block with arm? Do we need to apply the damage to it?
  let options = `<option value="Brawling"> ${game.i18n.localize("WITCHER.SkRefBrawling")} </option>`;
  weapons.forEach(item => options += `<option value="${item.system.attackSkill}" itemId="${item.id}" type="Weapon"> ${item.name} (${item.getItemAttackSkill().alias})</option>`);
  shields.forEach(item => options += `<option value="Melee" itemId="${item.id}" type="Shield"> ${item.name} (${game.i18n.localize("WITCHER.SkRefMelee")})</option>`);

  const content = `<label>${game.i18n.localize("WITCHER.Dialog.DefenseWith")}: </label><select name="form">${options}</select><br />`;

  new Dialog({
    title: `${game.i18n.localize("WITCHER.Dialog.DefenseTitle")}`,
    content,
    buttons: {
      Block: {
        label: `${game.i18n.localize("WITCHER.Dialog.ButtonBlock")}`,
        callback: (html) => {
          let item_id = html.find("[name=form]")[0].selectedOptions[0].getAttribute('itemid')
          let type = html.find("[name=form]")[0].selectedOptions[0].getAttribute('type')
          if (item_id) {
            let item = actor.items.get(item_id);
            if (type == "Weapon") {
              item.update({ 'system.reliable': item.system.reliable - 1 })
              if (item.system.reliable - 1 <= 0) {
                return ui.notifications.error(game.i18n.localize("WITCHER.Weapon.Broken"));
              }
            }
            else {
              item.update({ 'system.reliability': item.system.reliability - 1 })
              if (item.system.reliability - 1 <= 0) {
                return ui.notifications.error(game.i18n.localize("WITCHER.Shield.Broken"));
              }
            }
          }
        }
      }
    }
  }).render(true)
}

function ExecuteDefence(actor, attackType, location, totalAttack) {
  let displayRollDetails = game.settings.get("TheWitcherTRPG", "displayRollsDetails")

  let weapons = actor.items.filter(function (item) { return item.type == "weapon" && !item.system.isAmmo && WITCHER.meleeSkills.includes(item.system.attackSkill) });
  let shields = actor.items.filter(function (item) { return item.type == "armor" && item.system.location == "Shield" });
  let options = `<option value="Brawling"> ${game.i18n.localize("WITCHER.SkRefBrawling")} </option>`;
  weapons.forEach(item => options += `<option value="${item.system.attackSkill}" itemId="${item.id}" type="Weapon"> ${item.name} (${item.getItemAttackSkill().alias})</option>`);
  shields.forEach(item => options += `<option value="Melee" itemId="${item.id}" type="Shield"> ${item.name} (${game.i18n.localize("WITCHER.SkRefMelee")})</option>`);

  const content = `
    <div class="flex">
        <label>${game.i18n.localize("WITCHER.Dialog.DefenseExtra")}: <input type="checkbox" name="isExtraDefense"></label> <br />
    </div>
    <label>${game.i18n.localize("WITCHER.Dialog.DefenseWith")}: </label><select name="form">${options}</select><br />
    <label>${game.i18n.localize("WITCHER.Dialog.attackCustom")}: <input type="Number" class="small" name="customDef" value=0></label> <br />`;

  let messageData = {
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    flavor: `<h1>${game.i18n.localize("WITCHER.Dialog.Defense")}</h1>`,
  }

  new Dialog({
    title: `${game.i18n.localize("WITCHER.Dialog.DefenseTitle")}`,
    content,
    buttons: {
      Dodge: {
        label: `${game.i18n.localize("WITCHER.Dialog.ButtonDodge")}`,
        callback: async html => {
          let isExtraDefence = html.find("[name=isExtraDefense]").prop("checked");
          let customDef = html.find("[name=customDef]")[0].value;
          if (isExtraDefence) {
            let newSta = actor.system.derivedStats.sta.value - 1
            if (newSta < 0) {
              return ui.notifications.error(game.i18n.localize("WITCHER.Spell.notEnoughSta"));
            }
            actor.update({
              'system.derivedStats.sta.value': newSta
            });
          }
          let stat = actor.system.stats.ref.current;
          let skill = actor.system.skills.ref.dodge;
          let skillValue = skill.value;
          let displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefDodge")}`;
          messageData.flavor = `<h1>${game.i18n.localize("WITCHER.Dialog.Defense")}: ${game.i18n.localize("WITCHER.Dialog.ButtonDodge")}</h1><p>${displayFormula}</p>`;
          let rollFormula = !displayRollDetails ? `1d10+${stat}+${skillValue}` : `1d10+${stat}[${game.i18n.localize("WITCHER.Actor.Stat.Ref")}]+${skillValue}[${game.i18n.localize("WITCHER.SkRefDodge")}]`;

          if (customDef != "0") {
            rollFormula += !displayFormula ? `+${customDef}` : `+${customDef}[${game.i18n.localize("WITCHER.Settings.Custom")}]`;
          }

          rollFormula = addModifiers(skill.modifiers, rollFormula)

          let config = new RollConfig()
          config.showCrit = true
          config.showSuccess = true
          config.defence = true
          config.threshold = totalAttack
          config.thresholdDesc = skill.label
          config.flagsOnSuccess = actor.getDefenceSuccessFlags(skill)
          config.flagsOnFailure = actor.getDefenceFailFlags(skill)

          await extendedRoll(rollFormula, messageData, config)
        }
      },
      Reposition: {
        label: `${game.i18n.localize("WITCHER.Dialog.ButtonReposition")}`,
        callback: async html => {
          let isExtraDefence = html.find("[name=isExtraDefense]").prop("checked");
          let customDef = html.find("[name=customDef]")[0].value;
          if (isExtraDefence) {
            let newSta = actor.system.derivedStats.sta.value - 1
            if (newSta < 0) {
              return ui.notifications.error(game.i18n.localize("WITCHER.Spell.notEnoughSta"));
            }
            actor.update({
              'system.derivedStats.sta.value': newSta
            });
          }
          let stat = actor.system.stats.dex.current;
          let skill = actor.system.skills.dex.athletics;
          let skillValue = skill.value;
          let displayFormula = `1d10 + ${game.i18n.localize("WITCHER.StDex")} + ${game.i18n.localize("WITCHER.SkDexAthletics")}`;
          messageData.flavor = `<h1>${game.i18n.localize("WITCHER.Dialog.Defense")}: ${game.i18n.localize("WITCHER.Dialog.ButtonReposition")}</h1><p>${displayFormula}</p>`;
          let rollFormula = !displayRollDetails ? `1d10+${stat}+${skillValue}` : `1d10+${stat}[${game.i18n.localize("WITCHER.StDex")}]+${skillValue}[${game.i18n.localize("WITCHER.SkDexAthletics")}]`;

          if (customDef != "0") {
            rollFormula += !displayFormula ? `+${customDef}` : `+${customDef}[${game.i18n.localize("WITCHER.Settings.Custom")}]`;
          }

          rollFormula = addModifiers(skill.modifiers, rollFormula)

          let config = new RollConfig()
          config.showCrit = true
          config.showSuccess = true
          config.defence = true
          config.threshold = totalAttack
          config.thresholdDesc = skill.label
          config.flagsOnSuccess = actor.getDefenceSuccessFlags(skill)
          config.flagsOnFailure = actor.getDefenceFailFlags(skill)

          await extendedRoll(rollFormula, messageData, config)
        }
      },
      Block: {
        label: `${game.i18n.localize("WITCHER.Dialog.ButtonBlock")}`,
        callback: async html => {
          let isExtraDefence = html.find("[name=isExtraDefense]").prop("checked");
          let customDef = html.find("[name=customDef]")[0].value;
          if (isExtraDefence) {
            let newSta = actor.system.derivedStats.sta.value - 1
            if (newSta < 0) {
              return ui.notifications.error(game.i18n.localize("WITCHER.Spell.notEnoughSta"));
            }
            actor.update({
              'system.derivedStats.sta.value': newSta
            });
          }
          let defence = html.find("[name=form]")[0].value;
          let stat = actor.system.stats.ref.current;
          let skill = actor.system.skills.ref[defence.toLowerCase().replace('/', '').replace(' ', '')];
          let skillValue = skill.value;
          let skillName = skill.label;
          let modifiers = skill.modifiers
          let displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")}`;
          switch (defence) {
            case "Brawling":
              displayFormula += `${game.i18n.localize("WITCHER.SkRefBrawling")}`;
              break;
            case "Melee":
              displayFormula = `${game.i18n.localize("WITCHER.SkRefMelee")}`;
              break;
            case "Swordsmanship":
              displayFormula = `${game.i18n.localize("WITCHER.SkRefSwordsmanship")}`;
              break;
            case "Small Blades":
              displayFormula = `${game.i18n.localize("WITCHER.SkRefSmall")}`;
              break;
            case "Staff/Spear":
              displayFormula = `${game.i18n.localize("WITCHER.SkRefStaff")}`;
              break;
          }

          messageData.flavor = `<h1>${game.i18n.localize("WITCHER.Dialog.Defense")}: ${game.i18n.localize("WITCHER.Dialog.ButtonBlock")}</h1><p>${displayFormula}</p>`;
          let rollFormula = !displayRollDetails ? `1d10+${stat}+${skillValue}` : `1d10+${stat}[${game.i18n.localize("WITCHER.Actor.Stat.Ref")}]+${skillValue}[${game.i18n.localize(skillName)}]`;

          if (customDef != "0") {
            rollFormula += !displayFormula ? `+${customDef}` : `+${customDef}[${game.i18n.localize("WITCHER.Settings.Custom")}]`;
          }

          rollFormula = addModifiers(modifiers, rollFormula)

          let config = new RollConfig()
          config.showCrit = true
          config.showSuccess = true
          config.defence = true
          config.threshold = totalAttack
          config.thresholdDesc = skill.label
          config.flagsOnSuccess = actor.getDefenceSuccessFlags(skill)
          config.flagsOnFailure = actor.getDefenceFailFlags(skill)

          await extendedRoll(rollFormula, messageData, config)
        }
      },
      Parry: {
        label: `${game.i18n.localize("WITCHER.Dialog.ButtonParry")}`,
        callback: async html => {
          let isExtraDefence = html.find("[name=isExtraDefense]").prop("checked");
          let customDef = html.find("[name=customDef]")[0].value;
          if (isExtraDefence) {
            let newSta = actor.system.derivedStats.sta.value - 1
            if (newSta < 0) {
              return ui.notifications.error(game.i18n.localize("WITCHER.Spell.notEnoughSta"));
            }
            actor.update({
              'system.derivedStats.sta.value': newSta
            });
          }
          let defence = html.find("[name=form]")[0].value;
          let stat = actor.system.stats.ref.current;
          let skill = actor.system.skills.ref[defence.toLowerCase().replace('/', '').replace(' ', '')];
          let skillValue = skill.value;
          let skillName = skill.label;
          let modifiers = skill.modifiers
          let displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.Dialog.ButtonParry")}`;
          switch (defence) {
            case "Brawling":
              displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefBrawling")} - 3`;
              break;
            case "Melee":
              displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefMelee")} - 3`;
              break;
            case "Small Blades":
              displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefSmall")} - 3`;
              break;
            case "Staff/Spear":
              displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefStaff")} - 3`;
              break;
            case "Swordsmanship":
              displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefSwordsmanship")} - 3`;
              break;
          }

          messageData.flavor = `<h1>${game.i18n.localize("WITCHER.Dialog.Defense")}: ${game.i18n.localize("WITCHER.Dialog.ButtonParry")}</h1><p>${displayFormula}</p>`;
          let rollFormula = !displayRollDetails ? `1d10+${stat}+${skillValue}-3` : `1d10+${stat}[${game.i18n.localize("WITCHER.Actor.Stat.Ref")}]+${skillValue}[${game.i18n.localize(skillName)}]-3[${game.i18n.localize("WITCHER.Dialog.ButtonParry")}]`;

          if (customDef != "0") {
            rollFormula += !displayFormula ? `+${customDef}` : `+${customDef}[${game.i18n.localize("WITCHER.Settings.Custom")}]`;
          }

          rollFormula = addModifiers(modifiers, rollFormula)

          let config = new RollConfig()
          config.showCrit = true
          config.showSuccess = true
          config.defence = true
          config.threshold = totalAttack
          config.thresholdDesc = skill.label
          config.flagsOnSuccess = actor.getDefenceSuccessFlags(skill)
          config.flagsOnFailure = actor.getDefenceFailFlags(skill)

          await extendedRoll(rollFormula, messageData, config)
        }
      },
      ParryAgainstThrown: {
        label: `${game.i18n.localize("WITCHER.Dialog.ButtonParryThrown")}`,
        callback: async html => {
          let isExtraDefence = html.find("[name=isExtraDefense]").prop("checked");
          let customDef = html.find("[name=customDef]")[0].value;
          if (isExtraDefence) {
            let newSta = actor.system.derivedStats.sta.value - 1
            if (newSta < 0) {
              return ui.notifications.error(game.i18n.localize("WITCHER.Spell.notEnoughSta"));
            }
            actor.update({
              'system.derivedStats.sta.value': newSta
            });
          }
          let defence = html.find("[name=form]")[0].value;
          let stat = actor.system.stats.ref.current;
          let skill = actor.system.skills.ref[defence.toLowerCase().replace('/', '').replace(' ', '')];
          let skillValue = skill.value;
          let skillName = skill.label;
          let modifiers = skill.modifiers
          let displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.Dialog.ButtonParryThrown")}`;
          switch (defence) {
            case "Brawling":
              displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefBrawling")} - 5`;
              break;
            case "Melee":
              displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefMelee")} - 5`;
              break;
            case "Small Blades":
              displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefSmall")} - 5`;
              break;
            case "Staff/Spear":
              displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefStaff")} - 5`;
              break;
            case "Swordsmanship":
              displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Ref")} + ${game.i18n.localize("WITCHER.SkRefSwordsmanship")} - 5`;
              break;
          }

          messageData.flavor = `<h1>${game.i18n.localize("WITCHER.Dialog.Defense")}: ${game.i18n.localize("WITCHER.Dialog.ButtonParryThrown")}</h1><p>${displayFormula}</p>`;
          let rollFormula = !displayRollDetails ? `1d10+${stat}+${skillValue}-5` : `1d10+${stat}[${game.i18n.localize("WITCHER.Actor.Stat.Ref")}]+${skillValue}[${game.i18n.localize(skillName)}]-5[${game.i18n.localize("WITCHER.Dialog.ButtonParryThrown")}]`;

          if (customDef != "0") {
            rollFormula += !displayFormula ? `+${customDef}` : `+${customDef}[${game.i18n.localize("WITCHER.Settings.Custom")}]`;
          }

          rollFormula = addModifiers(modifiers, rollFormula)

          let config = new RollConfig()
          config.showCrit = true
          config.showSuccess = true
          config.defence = true
          config.threshold = totalAttack
          config.thresholdDesc = skill.label
          config.flagsOnSuccess = actor.getDefenceSuccessFlags(skill)
          config.flagsOnFailure = actor.getDefenceFailFlags(skill)

          await extendedRoll(rollFormula, messageData, config)
        }
      },
      MagicResist: {
        label: `${game.i18n.localize("WITCHER.Dialog.ButtonMagicResist")}`,
        callback: async html => {
          let isExtraDefence = html.find("[name=isExtraDefense]").prop("checked");
          let customDef = html.find("[name=customDef]")[0].value;
          if (isExtraDefence) {
            let newSta = actor.system.derivedStats.sta.value - 1
            if (newSta < 0) {
              return ui.notifications.error(game.i18n.localize("WITCHER.Spell.notEnoughSta"));
            }
            actor.update({
              'system.derivedStats.sta.value': newSta
            });
          }
          let stat = actor.system.stats.will.current;
          let skill = actor.system.skills.will.resistmagic;
          let skillValue = skill.value;
          let displayFormula = `1d10 + ${game.i18n.localize("WITCHER.Actor.Stat.Will")} + ${game.i18n.localize("WITCHER.SkWillResistMagLable")}`;
          messageData.flavor = `<h1>${game.i18n.localize("WITCHER.Dialog.Defense")}: ${game.i18n.localize("WITCHER.Dialog.ButtonMagicResist")}</h1><p>${displayFormula}</p>`;
          let rollFormula = !displayRollDetails ? `1d10+${stat}+${skillValue}` : `1d10+${stat}[${game.i18n.localize("WITCHER.Actor.Stat.Will")}]+${skillValue}[${game.i18n.localize("WITCHER.SkWillResistMagLable")}]`;

          if (customDef != "0") {
            rollFormula += !displayFormula ? `+${customDef}` : `+${customDef}[${game.i18n.localize("WITCHER.Settings.Custom")}]`;
          }

          rollFormula = addModifiers(skill.modifiers, rollFormula)

          let config = new RollConfig()
          config.showCrit = true
          config.showSuccess = true
          config.defence = true
          config.threshold = totalAttack
          config.thresholdDesc = skill.label
          config.flagsOnSuccess = actor.getDefenceSuccessFlags(skill)
          config.flagsOnFailure = actor.getDefenceFailFlags(skill)

          await extendedRoll(rollFormula, messageData, config)
        }
      },
    }
  }).render(true)
}

export { ExecuteDefence, BlockAttack, ApplyNormalDamage, ApplyNonLethalDamage };