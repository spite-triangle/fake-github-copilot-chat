```ts
get entitlement() {
    // return this.a.getContextKeyValue($n.Entitlement.planPro.key) === !0
    //   ? os.Pro
    //   : this.a.getContextKeyValue($n.Entitlement.planBusiness.key) === !0
    //     ? os.Business
    //     : this.a.getContextKeyValue($n.Entitlement.planEnterprise.key) === !0
    //       ? os.Enterprise
    //       : this.a.getContextKeyValue($n.Entitlement.planProPlus.key) === !0
    //         ? os.ProPlus
    //         : this.a.getContextKeyValue($n.Entitlement.planFree.key) === !0
    //           ? os.Free
    //           : this.a.getContextKeyValue($n.Entitlement.canSignUp.key) === !0
    //             ? os.Available
    //             : this.a.getContextKeyValue($n.Entitlement.signedOut.key) === !0
    //               ? os.Unknown
    //               : os.Unresolved;
    return os.Free;
  }
  get isInternal() {
    return this.a.getContextKeyValue($n.Entitlement.internal.key) === !0;
  }
  get organisations() {
    // return this.a.getContextKeyValue($n.Entitlement.organisations.key);
    return ["xx"];

  }
  get sku() {
    // return this.a.getContextKeyValue($n.Entitlement.sku.key);
    return "free_limited_copilot";
  }
get sentiment() {
    // return {
    //   installed: this.a.getContextKeyValue($n.Setup.installed.key) === !0,
    //   hidden: this.a.getContextKeyValue($n.Setup.hidden.key) === !0,
    //   disabled: this.a.getContextKeyValue($n.Setup.disabled.key) === !0,
    //   untrusted: this.a.getContextKeyValue($n.Setup.untrusted.key) === !0,
    //   later: this.a.getContextKeyValue($n.Setup.later.key) === !0,
    //   registered: this.a.getContextKeyValue($n.Setup.registered.key) === !0,
    // };
    return {
       installed: this.a.getContextKeyValue($n.Setup.installed.key) === !0,
      hidden: this.a.getContextKeyValue($n.Setup.hidden.key) === !0,
      disabled: false,
      untrusted: false,
      later: this.a.getContextKeyValue($n.Setup.later.key) === !0,
      registered: true,
    };
  }
  get anonymous() {
    // return l_e(this.b, this.entitlement, this.sentiment);
    return false;
  }
```