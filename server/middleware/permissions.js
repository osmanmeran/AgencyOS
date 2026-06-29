const TIER_HIERARCHY = { admin: 100, manager: 50, accounting: 40, agent: 10 };

export function requireTier(minTier) {
  return (req, res, next) => {
    const userTier = req.user?.user_tier;
    if (!userTier) {
      return res.status(403).json({ message: 'No user tier assigned' });
    }
    const userLevel = TIER_HIERARCHY[userTier] || 0;
    const requiredLevel = TIER_HIERARCHY[minTier] || 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ message: `Insufficient permissions. Requires ${minTier} tier.` });
    }
    next();
  };
}
