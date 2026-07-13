export const defectCatalog = [
  {
    id: "crack",
    label: "Трещина",
    defaultComment:
      "Обнаружена трещина. Требуется уточнение расположения, протяжённости и визуальных особенностей дефекта.",
    requiredPrompts: [
      "Укажите, где расположен дефект.",
      "Опишите визуальный характер трещины.",
      "При необходимости добавьте ориентировочные размеры."
    ]
  },
  {
    id: "honeycombing",
    label: "Раковина / пористость бетона",
    defaultComment:
      "Выявлены участки раковин и пористости бетона. Требуется уточнение зоны распространения и характера поверхности.",
    requiredPrompts: [
      "Укажите элемент конструкции.",
      "Опишите площадь или локальность повреждения.",
      "Зафиксируйте видимые следы расслоения или пустот."
    ]
  },
  {
    id: "spalling",
    label: "Скол / разрушение защитного слоя",
    defaultComment:
      "Обнаружен скол либо разрушение защитного слоя. Требуется уточнение площади повреждения и сопутствующих признаков.",
    requiredPrompts: [
      "Укажите место дефекта.",
      "Опишите характер разрушения.",
      "Отметьте наличие оголения арматуры, если оно наблюдается."
    ]
  },
  {
    id: "corrosion",
    label: "Коррозия / следы ржавчины",
    defaultComment:
      "Зафиксированы признаки коррозии или ржавчины. Требуется уточнение источника, зоны распространения и состояния поверхности.",
    requiredPrompts: [
      "Укажите конструктивный элемент.",
      "Опишите интенсивность и распространение следов.",
      "Добавьте связь с возможным увлажнением, если она очевидна."
    ]
  },
  {
    id: "leakage",
    label: "Протечка / увлажнение",
    defaultComment:
      "Обнаружены следы протечки либо увлажнения. Требуется уточнение локализации и визуальных признаков воздействия влаги.",
    requiredPrompts: [
      "Укажите место и направление следов влаги.",
      "Опишите интенсивность проявления.",
      "При наличии отметьте вторичные повреждения отделки или конструкции."
    ]
  },
  {
    id: "geometry",
    label: "Отклонение геометрии / монтажа",
    defaultComment:
      "Зафиксировано визуальное отклонение геометрии либо исполнения. Требуется уточнение элемента и характера отклонения.",
    requiredPrompts: [
      "Укажите конструктивный элемент.",
      "Опишите, в чём проявляется отклонение.",
      "Если возможно, добавьте ориентировочную величину отклонения."
    ]
  },
  {
    id: "unfinished",
    label: "Незавершённые / некачественные работы",
    defaultComment:
      "Выявлены незавершённые либо некачественно выполненные работы. Требуется уточнение состава и состояния работ.",
    requiredPrompts: [
      "Укажите вид работ.",
      "Опишите, чего именно не хватает или что выполнено некачественно.",
      "Добавьте контекст участка или помещения."
    ]
  },
  {
    id: "other",
    label: "Иной дефект",
    defaultComment:
      "Обнаружен дефект, требующий текстового уточнения характера, расположения и признаков.",
    requiredPrompts: [
      "Опишите дефект своими словами.",
      "Укажите место выявления.",
      "Зафиксируйте важные визуальные детали."
    ]
  }
]

const defectCatalogMap = new Map(defectCatalog.map((item) => [item.id, item]))
const defectCatalogEn = {
  crack: {
    label: "Crack"
  },
  honeycombing: {
    label: "Honeycombing / porous concrete"
  },
  spalling: {
    label: "Spalling / cover loss"
  },
  corrosion: {
    label: "Corrosion / rust traces"
  },
  leakage: {
    label: "Leakage / moisture"
  },
  geometry: {
    label: "Geometry / installation deviation"
  },
  unfinished: {
    label: "Incomplete / poor-quality works"
  },
  other: {
    label: "Other defect"
  }
}

export function getDefectTypeMeta(defectType) {
  return defectCatalogMap.get(defectType) ?? defectCatalogMap.get("other")
}

export function getLocalizedDefectTypeMeta(defectType, locale = "ru") {
  const base = getDefectTypeMeta(defectType)

  if (locale !== "en") {
    return base
  }

  const localized = defectCatalogEn[base.id]

  return localized ? { ...base, ...localized } : base
}
