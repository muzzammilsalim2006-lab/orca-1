"""Multilingual translation and Indic localization service."""

import re
from typing import Any, Dict, Optional, Tuple


class TranslationService:
    # Indic script character ranges
    SCRIPT_RANGES = {
        "hi": (0x0900, 0x097F),  # Devanagari (Hindi)
        "mr": (0x0900, 0x097F),  # Devanagari (Marathi)
        "ta": (0x0B80, 0x0BFF),  # Tamil
        "ml": (0x0D00, 0x0D7F),  # Malayalam
    }

    # Common maritime terms in Indic languages
    PORT_TRANSLITERATIONS = {
        "kochi": ["kochi", "cochin", "कोच्चि", "കൊച്ചി", "கொச்சி"],
        "mumbai": ["mumbai", "bombay", "मुंबई", "மும்பை"],
        "chennai": ["chennai", "madras", "चेन्नई", "சென்னை"],
        "visakhapatnam": ["vizag", "visakhapatnam", "विशाखापट्टनम", "விசாகப்பட்டினம்"],
        "mangalore": ["mangalore", "mangaluru", "मंगलौर", "മംഗലാപുരം"],
        "veraval": ["veraval", "वेरावल"],
        "puri": ["puri", "पुरी"],
    }

    @classmethod
    def detect_language(cls, text: str) -> str:
        """Detects language code (en, hi, ml, ta, mr) based on character block frequency."""
        if not text:
            return "en"

        counts = {"en": 0, "hi": 0, "ml": 0, "ta": 0, "mr": 0}
        has_marathi_markers = any(w in text for w in ["आहे", "नाही", "मासेमारी", "करावे", "जावे"])

        for char in text:
            cp = ord(char)
            if 0x0D00 <= cp <= 0x0D7F:
                counts["ml"] += 1
            elif 0x0B80 <= cp <= 0x0BFF:
                counts["ta"] += 1
            elif 0x0900 <= cp <= 0x097F:
                if has_marathi_markers:
                    counts["mr"] += 1
                else:
                    counts["hi"] += 1
            elif ("a" <= char.lower() <= "z"):
                counts["en"] += 1

        detected = max(counts, key=counts.get)
        return detected if counts[detected] > 0 else "en"

    @classmethod
    def canonicalize_port(cls, query: str) -> Optional[str]:
        """Maps multilingual city/port mentions to standard canonical port names."""
        q = query.lower()
        for canonical, aliases in cls.PORT_TRANSLITERATIONS.items():
            for alias in aliases:
                if alias.lower() in q:
                    return canonical.capitalize()
        return None

    @classmethod
    def localize_explanation(
        cls,
        english_explanation: str,
        target_lang: str,
        risk_level: str,
        location_name: str,
        selected_zone: str,
    ) -> str:
        """Localizes the final operational briefing into the target Indic language."""
        lang = target_lang.lower()

        # Localize port name if available in native script
        INDIC_PORT_NAMES = {
            "hi": {"kochi": "कोच्चि", "mumbai": "मुंबई", "chennai": "चेन्नई", "visakhapatnam": "विशाखापट्टनम", "mangalore": "मंगलौर", "veraval": "वेरावल", "puri": "पुरी"},
            "ml": {"kochi": "കൊച്ചി", "mumbai": "മുംബൈ", "chennai": "ചെന്നൈ", "visakhapatnam": "വിശാഖപട്ടണം", "mangalore": "മംഗലാപുരം"},
            "ta": {"kochi": "கொச்சி", "mumbai": "மும்பை", "chennai": "சென்னை", "visakhapatnam": "விசாகப்பட்டினம்"},
            "mr": {"kochi": "कोची", "mumbai": "मुंबई", "chennai": "चेन्नई"},
        }
        loc_display = INDIC_PORT_NAMES.get(lang, {}).get(location_name.lower(), location_name)

        if lang == "hi":
            advisories = {
                "LOW": f"{loc_display} से {selected_zone} की ओर समुद्री स्थिति सामान्य और अनुकूल है। जोखिम स्तर कम है। कृपया मौसम चेतावनियों का पालन करें।",
                "MODERATE": f"{loc_display} के पास {selected_zone} में सावधानीपूर्वक संचालन की सलाह दी जाती है। जोखिम स्तर मध्यम है। वीएचएफ चैनल 16 पर सतर्क रहें।",
                "HIGH": f"{loc_display} तट पर समुद्र अशांत है। अनावश्यक नौकायन से बचें। जोखिम स्तर उच्च है।",
                "SEVERE": f"गंभीर मौसम चेतावनी! {loc_display} क्षेत्र में सभी प्रकार की मछली पकड़ने की गतिविधियाँ तत्काल निलंबित करें।",
            }
            return advisories.get(risk_level, english_explanation)

        elif lang == "ml":
            advisories = {
                "LOW": f"{location_name} തീരത്തുനിന്ന് {selected_zone} ഭാഗത്തേക്ക് കടൽ ശാന്തവും അനുകൂലവുമാണ്. അപകടസാധ്യത കുറവാണ്. സാധാരണ മുൻകരുതലുകൾ പാലിക്കുക.",
                "MODERATE": f"{location_name} തീരത്ത് {selected_zone} മേഖലയിൽ ജാഗ്രത പാലിക്കുക. അപകടസാധ്യത മിതമാണ്. സുരക്ഷാ ഉപകരണങ്ങൾ കരുതുക.",
                "HIGH": f"{location_name} തീരത്ത് കടൽ പ്രക്ഷുബ്ധമാകാൻ സാധ്യതയുണ്ട്. ചെറുവള്ളങ്ങൾ കടലിൽ പോകുന്നത് ഒഴിവാക്കുക.",
                "SEVERE": f"തീവ്ര ചുഴലിക്കാറ്റ് / കാലാവസ്ഥാ മുന്നറിയിപ്പ്! {location_name} തീരത്തുനിന്ന് മത്സ്യബന്ധനം പൂർണ്ണമായി നിർത്തിവെയ്ക്കുക.",
            }
            return advisories.get(risk_level, english_explanation)

        elif lang == "ta":
            advisories = {
                "LOW": f"{location_name} கடற்கரையிலிருந்து {selected_zone} பகுதிக்கு கடல் நிலை சாதகமாக உள்ளது. ஆபத்து குறைவு.",
                "MODERATE": f"{location_name} அருகே {selected_zone} பகுதியில் எச்சரிக்கையுடன் செயல்படவும். ஆபத்து மிதமானது.",
                "HIGH": f"{location_name} கடற்பகுதியில் அலைகள் அதிகம். சிறிய படகுகள் கடலுக்குச் செல்வதைத் தவிர்க்கவும்.",
                "SEVERE": f"கடுமையான புயல் எச்சரிக்கை! {location_name} பகுதியில் அனைத்து மீன்பிடி நடவடிக்கைகளும் உடனடியாக நிறுத்தப்பட வேண்டும்.",
            }
            return advisories.get(risk_level, english_explanation)

        elif lang == "mr":
            advisories = {
                "LOW": f"{location_name} किनारपट्टीवरून {selected_zone} कडे समुद्राची स्थिती अनुकूल आहे. धोका कमी आहे.",
                "MODERATE": f"{location_name} भागात {selected_zone} कडे सावधगिरीने मासेमारी करावी. धोका मध्यम आहे.",
                "HIGH": f"{location_name} भागात समुद्र खवळलेला आहे. लहान बोटींनी खोल समुद्रात जाणे टाळावे.",
                "SEVERE": f"तीव्र हवामान इशारा! {location_name} किनारपट्टीवर सर्व मासेमारी तात्काळ थांबवण्यात यावी.",
            }
            return advisories.get(risk_level, english_explanation)

        return english_explanation


translation_service = TranslationService()
