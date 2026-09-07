from pydantic import BaseModel, ConfigDict


class TaxSlabSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slab_order: int
    lower_bound: float
    upper_bound: float | None = None
    rate: float
    label: str
    slab_type: str = "local"


class TaxConfigResponse(BaseModel):
    fiscal_year: str
    tax_free_threshold: float
    interest_exemption_limit: float
    wht_rate_resident: float
    has_foreign_tax: bool
    local_slabs: list[TaxSlabSchema]
    foreign_slabs: list[TaxSlabSchema]


class TaxConfigUpdate(BaseModel):
    tax_free_threshold: float | None = None
    interest_exemption_limit: float | None = None
    wht_rate_resident: float | None = None
    has_foreign_tax: bool | None = None
