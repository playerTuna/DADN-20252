import { Body, Controller, Get, Param, Patch, Req } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";

type JwtRequestUser = {
  userId: string;
  email: string;
};

@Controller("automation")
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get("rules")
  rules(@Req() req: { user?: JwtRequestUser }) {
    return this.automationService.getRules(req.user?.userId ?? "");
  }

  @Patch("rules/:deviceId")
  updateRule(
    @Req() req: { user?: JwtRequestUser },
    @Param("deviceId") deviceId: string,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    return this.automationService.updateRule(req.user?.userId ?? "", deviceId, dto);
  }

  @Get("logs")
  logs(@Req() req: { user?: JwtRequestUser }) {
    return this.automationService.getLogs(req.user?.userId ?? "");
  }
}
