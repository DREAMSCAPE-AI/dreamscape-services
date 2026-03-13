"""
US-IA-010 - Ollama Enricher

Client Python pour enrichir les recommandations via Ollama (Qwen2.5:7b)
avec validation JSON stricte et détection d'hallucinations.
"""

import json
import logging
import requests
from typing import Dict, List, Optional
from .prompt_templates import ENRICHMENT_PROMPT, SEMANTIC_TAGS, FALLBACK_ENRICHMENT_NOTE

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Raised when Ollama output doesn't match expected schema"""
    pass


class OllamaEnricher:
    """
    Client Ollama pour enrichissement sémantique des recommandations.

    Architecture :
    - Appel HTTP POST vers Ollama API (local ou VM remote)
    - Validation stricte du JSON retourné
    - Fallback gracieux si hallucination détectée
    """

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "qwen2.5:7b"):
        """
        Initialize Ollama client.

        Args:
            base_url: Ollama API base URL (default: localhost)
            model: Model to use (default: qwen2.5:7b)
        """
        self.base_url = base_url
        self.model = model
        self.timeout = 30  # seconds

    def enrich_recommendations(self, reco_data: Dict) -> Dict:
        """
        Enrichit les recommandations avec contexte sémantique.

        Args:
            reco_data: Dict contenant:
                - userId: str
                - recommendations: List[Dict] avec id, name, location, etc.

        Returns:
            Dict avec structure enrichie (destinations, global_insights)

        Raises:
            ValidationError: Si output JSON invalide
            requests.RequestException: Si erreur réseau
        """
        try:
            # Build prompt
            prompt = self._build_prompt(reco_data)

            # Call Ollama
            logger.info(f"[Ollama] Calling {self.model} for enrichment (userId={reco_data.get('userId')})")
            response = self._call_ollama(prompt)

            # Parse and validate JSON
            enriched = self._parse_and_validate(response)

            logger.info(f"[Ollama] Successfully enriched {len(enriched.get('destinations', []))} destinations")
            return enriched

        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(f"[Ollama] Hallucination detected: {e}")
            logger.warning(f"[Ollama] Raw response: {response[:200]}...")
            return self._fallback_enrichment(reco_data)

        except requests.RequestException as e:
            logger.error(f"[Ollama] Network error: {e}")
            return self._fallback_enrichment(reco_data)

    def _build_prompt(self, reco_data: Dict) -> str:
        """Build enrichment prompt from recommendation data"""
        # Simplify recommendations for prompt (keep only essential info)
        simplified_recos = [
            {
                "id": r.get("id", r.get("hotelId", "unknown")),
                "name": r.get("name", ""),
                "location": {
                    "city": r.get("location", {}).get("city", ""),
                    "country": r.get("location", {}).get("country", ""),
                },
                "score": r.get("score", 0),
                "reasons": r.get("reasons", []),
            }
            for r in reco_data.get("recommendations", [])[:10]  # Max 10 pour éviter prompt trop long
        ]

        recommendations_json = json.dumps(simplified_recos, indent=2, ensure_ascii=False)

        return ENRICHMENT_PROMPT.format(
            recommendations_json=recommendations_json,
            allowed_tags=", ".join(SEMANTIC_TAGS)
        )

    def _call_ollama(self, prompt: str) -> str:
        """
        Call Ollama API for generation.

        Args:
            prompt: System prompt

        Returns:
            Raw response text

        Raises:
            requests.RequestException: On network error
        """
        response = requests.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "format": "json",  # Force JSON output
                "options": {
                    "temperature": 0.3,  # Low temp for structured output
                    "top_p": 0.9,
                    "top_k": 40,
                    "num_predict": 2000,  # Max tokens
                }
            },
            timeout=self.timeout
        )

        response.raise_for_status()
        result = response.json()

        return result.get("response", "")

    def _parse_and_validate(self, response: str) -> Dict:
        """
        Parse JSON response and validate schema.

        Args:
            response: Raw JSON string from Ollama

        Returns:
            Validated enrichment dict

        Raises:
            json.JSONDecodeError: If invalid JSON
            ValidationError: If schema invalid
        """
        # Parse JSON
        try:
            data = json.loads(response)
        except json.JSONDecodeError as e:
            # Try to extract JSON from text (Ollama sometimes adds preamble)
            logger.warning("[Ollama] Invalid JSON, attempting extraction...")
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start != -1 and json_end > json_start:
                data = json.loads(response[json_start:json_end])
            else:
                raise e

        # Validate schema
        self._validate_schema(data)

        return data

    def _validate_schema(self, data: Dict) -> None:
        """
        Validate enrichment schema.

        Raises:
            ValidationError: If schema invalid
        """
        # Top-level keys
        if "destinations" not in data:
            raise ValidationError("Missing 'destinations' key")
        if "global_insights" not in data:
            raise ValidationError("Missing 'global_insights' key")

        if not isinstance(data["destinations"], list):
            raise ValidationError("'destinations' must be a list")

        # Validate each destination
        for idx, dest in enumerate(data["destinations"]):
            if "id" not in dest:
                raise ValidationError(f"Destination {idx}: missing 'id'")

            # Validate enriched_reasons
            if "enriched_reasons" in dest:
                reasons = dest["enriched_reasons"]
                if not isinstance(reasons, list):
                    raise ValidationError(f"Destination {idx}: enriched_reasons must be list")
                if len(reasons) > 3:
                    logger.warning(f"Destination {idx}: truncating enriched_reasons to 3")
                    dest["enriched_reasons"] = reasons[:3]

            # Validate alternatives
            if "alternatives" in dest:
                alts = dest["alternatives"]
                if not isinstance(alts, list):
                    raise ValidationError(f"Destination {idx}: alternatives must be list")
                if len(alts) > 2:
                    logger.warning(f"Destination {idx}: truncating alternatives to 2")
                    dest["alternatives"] = alts[:2]

            # Validate semantic_tags (must be from controlled vocabulary)
            if "semantic_tags" in dest:
                tags = dest["semantic_tags"]
                if not isinstance(tags, list):
                    raise ValidationError(f"Destination {idx}: semantic_tags must be list")

                invalid_tags = [t for t in tags if t not in SEMANTIC_TAGS]
                if invalid_tags:
                    logger.warning(f"Destination {idx}: invalid tags {invalid_tags}, removing")
                    dest["semantic_tags"] = [t for t in tags if t in SEMANTIC_TAGS]

                if len(dest["semantic_tags"]) > 5:
                    dest["semantic_tags"] = dest["semantic_tags"][:5]

    def _fallback_enrichment(self, reco_data: Dict) -> Dict:
        """
        Fallback enrichment when Ollama fails.

        Returns original recommendations with minimal enrichment.
        """
        logger.info("[Ollama] Using fallback enrichment (no LLM)")

        destinations = []
        for r in reco_data.get("recommendations", [])[:10]:
            dest = {
                "id": r.get("id", r.get("hotelId", "unknown")),
                "enriched_reasons": r.get("reasons", [])[:3],  # Keep original reasons
                "alternatives": [],
                "semantic_tags": self._guess_tags_from_data(r),
                "local_insights": ""
            }
            destinations.append(dest)

        return {
            "destinations": destinations,
            "global_insights": FALLBACK_ENRICHMENT_NOTE
        }

    def _guess_tags_from_data(self, recommendation: Dict) -> List[str]:
        """
        Guess semantic tags from recommendation data (rule-based).

        Fallback when LLM unavailable.
        """
        tags = []

        # Check location
        location = recommendation.get("location", {})
        city = location.get("city", "").lower()
        country = location.get("country", "").lower()

        # Beach cities
        beach_keywords = ["barcelona", "nice", "miami", "bali", "phuket", "santorini"]
        if any(kw in city for kw in beach_keywords):
            tags.append("beach")

        # Mountains
        mountain_keywords = ["chamonix", "aspen", "zermatt", "innsbruck"]
        if any(kw in city for kw in mountain_keywords):
            tags.append("mountains")

        # City breaks
        city_keywords = ["paris", "london", "new york", "tokyo", "rome"]
        if any(kw in city for kw in city_keywords):
            tags.append("city-break")
            tags.append("cultural")

        # Default if no match
        if not tags:
            tags.append("relaxation")

        return tags[:5]

    def health_check(self) -> Dict:
        """
        Check if Ollama service is healthy.

        Returns:
            Dict with status info
        """
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            response.raise_for_status()
            models = response.json().get("models", [])

            model_loaded = any(m.get("name", "").startswith(self.model) for m in models)

            return {
                "healthy": True,
                "model_loaded": model_loaded,
                "available_models": [m.get("name") for m in models]
            }
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e)
            }
