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
    label: "Crack",
    defaultComment:
      "A crack has been detected. Clarify the location, extent, and visible characteristics of the defect.",
    requiredPrompts: [
      "Specify where the defect is located.",
      "Describe the visible nature of the crack.",
      "Add approximate dimensions if available."
    ]
  },
  honeycombing: {
    label: "Honeycombing / porous concrete",
    defaultComment:
      "Honeycombing or porous concrete areas have been detected. Clarify the spread area and surface condition.",
    requiredPrompts: [
      "Specify the structural element.",
      "Describe the affected area or locality.",
      "Note visible delamination or voids if present."
    ]
  },
  spalling: {
    label: "Spalling / cover loss",
    defaultComment:
      "Spalling or cover layer damage has been detected. Clarify the damaged area and related signs.",
    requiredPrompts: [
      "Specify the defect location.",
      "Describe the nature of the damage.",
      "Note exposed reinforcement if visible."
    ]
  },
  corrosion: {
    label: "Corrosion / rust traces",
    defaultComment:
      "Signs of corrosion or rust have been recorded. Clarify the source, affected area, and surface condition.",
    requiredPrompts: [
      "Specify the structural element.",
      "Describe intensity and spread of traces.",
      "Add a link to possible moisture if obvious."
    ]
  },
  leakage: {
    label: "Leakage / moisture",
    defaultComment:
      "Signs of leakage or moisture have been detected. Clarify the location and visible moisture impact.",
    requiredPrompts: [
      "Specify location and direction of moisture traces.",
      "Describe the intensity of manifestation.",
      "Note secondary finish or structural damage if present."
    ]
  },
  geometry: {
    label: "Geometry / installation deviation",
    defaultComment:
      "A visible geometry or installation deviation has been recorded. Clarify the element and the nature of the deviation.",
    requiredPrompts: [
      "Specify the structural element.",
      "Describe how the deviation appears.",
      "Add an approximate deviation value if possible."
    ]
  },
  unfinished: {
    label: "Incomplete / poor-quality works",
    defaultComment:
      "Incomplete or poor-quality works have been identified. Clarify the work scope and current condition.",
    requiredPrompts: [
      "Specify the work type.",
      "Describe what is missing or poorly executed.",
      "Add context for the area or room."
    ]
  },
  other: {
    label: "Other defect",
    defaultComment:
      "A defect requiring textual clarification of type, location, and signs has been detected.",
    requiredPrompts: [
      "Describe the defect in your own words.",
      "Specify where it was found.",
      "Record important visual details."
    ]
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
