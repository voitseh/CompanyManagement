using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Data.Entity;
using CompanyManagement.Models;
using System.Data;
using System.Diagnostics;
using System.Net;

namespace CompanyManagement.Controllers
{
    public class CompanyController : Controller
    {

        private class CompanyView
        {
            public int id { get; set; }
            public string NodeName { get; set; }
            public int? ParentId { get; set; }
            public IList<CompanyView> children { get; set; }
            public int Earnings { get; set; }
            public int TotalEarnings { get; set; }
        }

        private class Earnings
        {
            public int Id { get; set; }
            public int? ParentId { get; set; }
            public int Earning { get; set; }
        }

        private TreeModelContainer db = new TreeModelContainer();

        // GET     /Company/Data/3
        // POST    /Company/Data    
        // PUT     /Company/Data/3  
        // DELETE  /Company/Data/3
        [RestHttpVerbFilter]
        public JsonResult Data(Company company, string httpVerb, int? id = null)
        {
            switch (httpVerb)
            {
                case "POST":
                    if (ModelState.IsValid)
                    {
                        if (company.ParentId == -1)
                            company.ParentId = null;
                        db.Entry(company).State = EntityState.Added;
                        db.SaveChanges();
                        return Json(company, JsonRequestBehavior.AllowGet);
                    }
                    else
                    {
                        Response.TrySkipIisCustomErrors = true;
                        Response.StatusCode = (int)HttpStatusCode.NotAcceptable;
                        return Json(new { Message = "Data is not Valid." }, JsonRequestBehavior.AllowGet);
                    }
                case "PUT":
                    if (ModelState.IsValid)
                    {
                        //if it's root - do nothing
                        if (company.Id != -1)
                        {
                            db.Entry(company).State = EntityState.Modified;
                            db.SaveChanges();
                        }
                        return Json(company, JsonRequestBehavior.AllowGet);
                    }
                    else
                    {
                        Response.TrySkipIisCustomErrors = true;
                        Response.StatusCode = (int)HttpStatusCode.NotAcceptable;
                        return Json(new { Message = "Company " + id + " Data is not Valid." }, JsonRequestBehavior.AllowGet);
                    }
                case "GET":
                    try
                    {
                        var allEarnings = db.Companies.Select(n => new Earnings
                        {
                            Id = n.Id,
                            ParentId = n.ParentId,
                            Earning = n.Earnings
                        }).ToList();

                        if (id.HasValue && id.Value != -1)
                        {
                            var single = from entity in db.Companies.Where(x => x.Id == id)
                                         select new
                                         {
                                             id = entity.Id,
                                             NodeName = entity.NodeName,
                                             Earnings = entity.Earnings,
                                             ParentId = entity.ParentId,
                                             children =
                                             from entity1 in db.Companies.Where(y => y.ParentId != null && y.ParentId == entity.Id)
                                             select new
                                             {
                                                 id = entity1.Id,
                                                 NodeName = entity1.NodeName,
                                                 Earnings = entity1.Earnings,
                                                 ParentId = entity1.ParentId,
                                                 children = "" // it couse checking children whenever needed
                                    }
                                         };

                            var companyById = single.First();

                            return Json(new CompanyView
                            {
                                id = companyById.id,
                                ParentId = companyById.ParentId,
                                NodeName = companyById.NodeName,
                                Earnings = companyById.Earnings,
                                TotalEarnings = GetEarnings(companyById.id, allEarnings),
                                children = ConvertToViewModel(companyById.children.ToList(), allEarnings)

                            }, JsonRequestBehavior.AllowGet);
                        }
                        else
                        {
                            var root = new
                            {
                                id = -1,
                                NodeName = "Company Store",
                                ParentId = (int?)null,
                                children = from entity in db.Companies.Where(y => y.ParentId == null)
                                           select new
                                           {
                                               id = entity.Id,
                                               NodeName = entity.NodeName,
                                               Earnings = entity.Earnings,
                                               ParentId = entity.ParentId,
                                               children = from entity1 in db.Companies.Where(y => y.ParentId != null && y.ParentId == entity.Id)
                                                          select new
                                                          {
                                                              id = entity1.Id,
                                                              NodeName = entity1.NodeName,
                                                              Earnings = entity1.Earnings,
                                                              ParentId = entity1.ParentId,
                                                              children = "" // it couse checking children whenever needed
                                                          }
                                           }
                            };
                            //convert to view model
                            var rootView = new CompanyView
                            {
                                id = -1,
                                NodeName = "Company Store",
                                ParentId = (int?)null,
                                children = ConvertToViewModel(root.children.ToList(), allEarnings)
                            };

                            return Json(rootView, JsonRequestBehavior.AllowGet);
                        }
                    }
                    catch (Exception ex)
                    {
                        Response.TrySkipIisCustomErrors = true;
                        Response.StatusCode = (int)HttpStatusCode.NotAcceptable;
                        return Json(new { Message = "Company " + id + " does not exist." }, JsonRequestBehavior.AllowGet);
                    }
                case "DELETE":
                    try
                    {
                        if (company.Id != -1)
                        {
                            company = db.Companies.Single(x => x.Id == id);
                            DeleteChildren(company.Id, db);
                            db.Companies.Remove(company);

                            db.SaveChanges();
                        }
                        return Json(company, JsonRequestBehavior.AllowGet);
                    }
                    catch (Exception ex)
                    {
                        Response.TrySkipIisCustomErrors = true;
                        Response.StatusCode = (int)HttpStatusCode.NotAcceptable;
                        return Json(new { Message = "Could not delete Company " + id }, JsonRequestBehavior.AllowGet);
                    }
            }
            return Json(new { Error = true, Message = "Unknown HTTP verb" }, JsonRequestBehavior.AllowGet);
        }

        private void DeleteChildren(int id, TreeModelContainer db)
        {
            var children = db.Companies.Where(child => child.ParentId.HasValue && child.ParentId == id);
            if (children.Any())
            {
                foreach (var child in children)
                {
                    DeleteChildren(child.Id, db);
                }
            }
            else
            {
                db.Companies.Remove(db.Companies.Single(n => n.Id == id));
            }
        }

        private IList<CompanyView> ConvertToViewModel(dynamic nodes, List<Earnings> allEarnings)
        {
            IList<CompanyView> viewData = new List<CompanyView>();
            foreach (var child in nodes)
            {
                var viewChild = new CompanyView
                {
                    id = child.id,
                    ParentId = null,
                    children = new List<CompanyView>(),
                    NodeName = child.NodeName,
                    Earnings = child.Earnings,
                    TotalEarnings = GetEarnings(child.id, allEarnings),
                };

                var innerChildren = child.children as IQueryable<dynamic>;
                if (innerChildren != null)
                {
                    foreach (var innerChild in innerChildren.ToList())
                    {
                        viewChild.children.Add(new CompanyView
                        {
                            id = innerChild.id,
                            ParentId = innerChild.ParentId,
                            children = new List<CompanyView>(),
                            NodeName = innerChild.NodeName,
                            Earnings = innerChild.Earnings,
                            TotalEarnings = GetEarnings(innerChild.id, allEarnings),
                        });
                    }
                }
                viewData.Add(viewChild);
            }
            return viewData;
        }

        private int GetEarnings(int id, IEnumerable<Earnings> allEarnings, bool isTopLevel = true)
        {
            var children = allEarnings.Where(n => n.ParentId.HasValue && n.ParentId.Value == id);
            var total = (isTopLevel ? allEarnings.Single(n => n.Id == id).Earning : 0)
                    + children.Sum(m => m.Earning)
                    + children.Sum(n => GetEarnings(n.Id, allEarnings, false));

            return total;
        }
    }
}
